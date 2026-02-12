/// <reference types="vite/client" />

declare const process: {
    env: {
        API_KEY: string;
        GEMINI_API_KEY: string;
        VITE_GROQ_API_KEY: string;
        GROQ_API_KEY: string;
        [key: string]: string | undefined;
    }
};
