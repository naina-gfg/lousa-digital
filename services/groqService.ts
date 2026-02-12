
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
          1. Transcreva TUDO o que está escrito.
          2. Mantenha a ordem dos slides.
          3. Para cada slide, gere um JSON com título, conteúdo (array de strings), resumo e palavras-chave.
          4. O formato de resposta DEVE ser EXATAMENTE este JSON:
          {
            "slides": [
              {
                "title": "Título do Slide",
                "content": ["Parágrafo 1", "Parágrafo 2"],
                "summary": "Resumo do slide",
                "keywords": ["tag1", "tag2"],
                "source_image_index": 0
              }
            ],
            "theme": "modern"
          }
          Retorne APENAS o JSON válido, sem markdown ou explicações adicionais.`
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
