
import Groq from "groq-sdk";

// Initialize Groq client with API key from environment variables
const getGroq = () => new Groq({
    apiKey: process.env.VITE_GROQ_API_KEY || process.env.GROQ_API_KEY,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

export const extractSlidesWithLlama = async (base64Images: string[]): Promise<any> => {
    const groq = getGroq();

    // Prepare images for Groq (Llama 4 Vision)
    // Groq expects image_url with base64 data
    const messages = [
        {
            role: "user",
            content: [
                {
                    type: "text",
                    text: `Você é um motor de OCR de altíssima precisão. Sua tarefa é digitalizar esta sequência de imagens de quadros de aula.
          
          REGRAS:
          1. Transcreva TUDO o que está escrito de forma LITERAL, EXAUSTIVA E INTEGRAL.
          2. Não resuma, não parafraseie e não pule nenhuma linha, parágrafo ou detalhe técnico.
          3. Mantenha a ordem cronológica/sequencial exata das imagens enviadas.
          4. IMPORTANTE: Gere EXATAMENTE UM SLIDE PARA CADA IMAGEM enviada. Se eu enviei X imagens, seu array 'slides' deve ter comprimento X.
          5. Para cada slide, extraia TODO o texto visível no campo 'content' (array de strings, onde cada item é um parágrafo ou tópico completo do quadro).
          6. Gere um título condizente, um resumo breve para indexação e palavras-chave.
          7. O formato de resposta DEVE ser EXATAMENTE este JSON:
          {
            "slides": [
              {
                "title": "Título do Slide",
                "content": ["Texto integral do primeiro parágrafo...", "Texto integral do segundo tópico...", "Continuação literal..."],
                "summary": "Resumo executivo",
                "keywords": ["tag1", "tag2"],
                "source_image_index": 0
              }
            ],
            "theme": "modern"
          }
          Retorne APENAS o JSON válido. O campo 'content' deve conter a transcrição completa e detalhada de tudo o que for legível na imagem.`
                },
                ...base64Images.map(base64 => ({
                    type: "image_url",
                    image_url: {
                        url: base64 // base64 string includes "data:image/jpeg;base64,..."
                    }
                }))
            ]
        }
    ];

    try {
        const completion = await groq.chat.completions.create({
            messages: messages as any, // Type cast might be needed depending on SDK version strictly matching
            model: "meta-llama/llama-4-maverick-17b-128e-instruct",
            temperature: 0.1,
            max_tokens: 8000,
            top_p: 1,
            stream: false,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) throw new Error("No content received from Llama");

        return JSON.parse(content);

    } catch (error) {
        console.error("Groq/Llama Error:", error);
        throw error;
    }
};
