const { GoogleGenAI, Type } = require('@google/genai');

/**
 * Phân tích prompt của người dùng để trả về intent JSON
 * @param {string} prompt 
 * @returns {Promise<Object>}
 */
exports.extractIntent = async (prompt) => {
    // Check if API Key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    const systemInstruction = `
Bạn là một chuyên gia phân tích âm nhạc cho hệ thống MusicFlow.
Nhiệm vụ của bạn là phân tích yêu cầu tạo playlist của người dùng và trả về MỘT OBJECT JSON DUY NHẤT.
KHÔNG giải thích, KHÔNG thêm markdown \`\`\`json, KHÔNG bịa danh sách bài hát.

Quy tắc BẮT BUỘC về nghệ sĩ (Artist Rules):
1. Bạn PHẢI bóc tách đúng nguyên văn tên nghệ sĩ nếu người dùng nhắc đến (ví dụ: Blackpink, Diệu Kiên, Sơn Tùng M-TP). KHÔNG tự ý chuyển tên nghệ sĩ thành thể loại nhạc.
2. Nếu người dùng nhắc đích danh nghệ sĩ (ví dụ "Tạo playlist Blackpink", "Nhạc của Diệu Kiên"):
   - artistConstraintMode = "hard"
   - allowSimilarArtists = false
3. Nếu người dùng yêu cầu nhạc giống/tương tự/cùng vibe nghệ sĩ nào đó (ví dụ "Nhạc giống Blackpink", "cùng vibe Sơn Tùng"):
   - artistConstraintMode = "soft"
   - allowSimilarArtists = true
4. Nếu không có nghệ sĩ nào được nhắc đến:
   - artistConstraintMode = "none"
   - allowSimilarArtists = true
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            playlistName: {
                type: Type.STRING,
                description: "Tên ngắn gọn, hấp dẫn cho playlist"
            },
            artists: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Danh sách tên nghệ sĩ được nhắc đến trong câu (nguyên văn)"
            },
            artistConstraintMode: {
                type: Type.STRING,
                description: "Chế độ: 'hard', 'soft', hoặc 'none' theo quy tắc Artist Rules"
            },
            allowSimilarArtists: {
                type: Type.BOOLEAN,
                description: "Cho phép lấy thêm nghệ sĩ tương tự hay không"
            },
            mood: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Các từ khóa chỉ tâm trạng (vd: chill, sad, romantic, energetic...)"
            },
            context: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Ngữ cảnh nghe nhạc (vd: night, rain, cafe, driving...)"
            },
            activity: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Hoạt động (vd: study, work, workout, party, sleep...)"
            },
            genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Thể loại nhạc (vd: pop, ballad, edm, lofi, r&b, rap...)"
            },
            languages: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Ngôn ngữ bài hát (vd: vi, en, ko, ja, any)"
            },
            tempo: {
                type: Type.STRING,
                description: "Tốc độ bài hát: slow, medium, fast, hoặc any"
            },
            energy: {
                type: Type.STRING,
                description: "Năng lượng: low, medium, high, hoặc any"
            },
            era: {
                type: Type.STRING,
                description: "Thời đại: old, new, hoặc any"
            },
            vibe: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Cảm giác tổng thể (vd: healing, nostalgia, hype...)"
            },
            explicitExclusions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Những thứ người dùng KHÔNG muốn nghe (vd: buồn, ồn ào...)"
            },
            keywords: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Các từ khóa bổ sung khác từ prompt, CHÚ Ý giữ lại các từ lóng tiếng Việt (suy, ngôn tình, quẩy, cháy...)"
            },
            targetCount: {
                type: Type.INTEGER,
                description: "Số lượng bài hát yêu cầu (mặc định 20 nếu không nhắc đến)"
            }
        },
        required: ["playlistName", "artistConstraintMode", "allowSimilarArtists"]
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [
                { role: 'user', parts: [{ text: prompt }] }
            ],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.3
            }
        });

        const textResponse = response.text;
        if (!textResponse) {
            throw new Error('Empty response from Gemini');
        }

        // Parse JSON
        const intent = JSON.parse(textResponse);
        return intent;
    } catch (error) {
        console.error('Error in geminiPlaylist.service extractIntent:', error);
        throw error;
    }
};
