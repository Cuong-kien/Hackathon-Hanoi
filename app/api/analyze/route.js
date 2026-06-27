import OpenAI from "openai";

// 1 vision pass phân tích ảnh phòng đầu vào (R-006). Tái dùng cho hotspot (R-005) + fallback ảnh xấu.
export const runtime = "nodejs";
export const maxDuration = 120;

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-4o";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }
function json(b, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json", ...CORS } });
}

// Phân tích mặc định (MOCK / fallback khi lỗi) — đủ để UI chạy được, coi như ảnh tốt.
const DEFAULT_ANALYSIS = {
  isRoom: true,
  quality: "good",
  angle: "good",
  environment: "indoor",
  roomType: "home-office",
  suggestedContext: "bàn làm việc trong nhà, có tường trống phía sau",
  detectedItems: ["bàn làm việc", "cửa sổ", "tường trống"],
  hotspots: [
    { area: "góc trái trên sàn", x: 0.18, y: 0.62, w: 0.22, h: 0.3 },
    { area: "trên mặt bàn", x: 0.55, y: 0.5, w: 0.2, h: 0.22 },
    { area: "tường phía sau", x: 0.45, y: 0.2, w: 0.3, h: 0.25 },
  ],
};

const PROMPT = [
  "Bạn là chuyên gia phân tích ảnh nội thất để chuẩn bị dựng cảnh ảo (virtual staging).",
  "Phân tích ảnh phòng/văn phòng người dùng gửi và CHỈ trả về JSON đúng schema sau (toạ độ chuẩn hoá 0..1 theo chiều rộng/cao ảnh):",
  '{',
  '  "isRoom": boolean,                       // ảnh có phải không gian nội thất (phòng/văn phòng) không',
  '  "quality": "good" | "poor",              // mờ/thiếu sáng/quá tối/nhiễu => "poor"',
  '  "angle": "good" | "bad",                 // góc chụp có dựng cảnh đẹp được không',
  '  "environment": "indoor" | "outdoor" | "mixed" | "unknown",',
  '  "roomType": string,                       // vd: "phòng khách", "bàn làm việc", "ban công", "sảnh"',
  '  "suggestedContext": string,               // tóm tắt ngắn điều đã nhận ra để tránh hỏi lại',
  '  "detectedItems": string[],               // các vật/đặc điểm thấy được (vd: "bàn làm việc","cửa sổ","tường trống")',
  '  "hotspots": [ { "area": string, "x": number, "y": number, "w": number, "h": number } ]  // 1-4 vùng KHẢ THI để đặt thêm đồ',
  '}',
  "Chỉ trả JSON, không giải thích.",
].join("\n");

export async function POST(req) {
  try {
    const form = await req.formData();
    const room = form.get("room");
    if (!room || typeof room === "string") return json({ error: "Thiếu ảnh phòng." }, 400);

    if (!process.env.OPENAI_API_KEY) {
      return json({ analysis: DEFAULT_ANALYSIS, mock: true });
    }

    const buf = Buffer.from(await room.arrayBuffer());
    const dataUrl = `data:${room.type || "image/png"};base64,${buf.toString("base64")}`;

    const openai = new OpenAI();
    const resp = await openai.chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ]},
      ],
    });

    let analysis;
    try { analysis = JSON.parse(resp.choices?.[0]?.message?.content || "{}"); }
    catch { analysis = {}; }

    // Chuẩn hoá + chốt mặc định an toàn
    analysis = {
      isRoom: analysis.isRoom !== false,
      quality: analysis.quality === "poor" ? "poor" : "good",
      angle: analysis.angle === "bad" ? "bad" : "good",
      environment: ["indoor", "outdoor", "mixed", "unknown"].includes(analysis.environment) ? analysis.environment : "unknown",
      roomType: typeof analysis.roomType === "string" ? analysis.roomType.slice(0, 80) : "",
      suggestedContext: typeof analysis.suggestedContext === "string" ? analysis.suggestedContext.slice(0, 160) : "",
      detectedItems: Array.isArray(analysis.detectedItems) ? analysis.detectedItems.slice(0, 8) : [],
      hotspots: Array.isArray(analysis.hotspots)
        ? analysis.hotspots.filter(h => typeof h.x === "number").slice(0, 4)
        : [],
    };
    return json({ analysis, mock: false });
  } catch (err) {
    console.error("[/api/analyze] error:", err);
    // Lỗi vision không được chặn luồng — coi như ảnh tốt để vẫn gen được.
    return json({ analysis: DEFAULT_ANALYSIS, mock: false, note: "analyze fallback: " + (err?.message || "error") });
  }
}
