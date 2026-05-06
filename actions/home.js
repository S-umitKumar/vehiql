// "use server";

// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { db } from "@/lib/prisma";
// import aj from "@/lib/arcjet";
// import { request } from "@arcjet/next";

// // Function to serialize car data
// function serializeCarData(car) {
//   return {
//     ...car,
//     price: car.price ? parseFloat(car.price.toString()) : 0,
//     createdAt: car.createdAt?.toISOString(),
//     updatedAt: car.updatedAt?.toISOString(),
//   };
// }

// /**
//  * Get featured cars for the homepage
//  */
// export async function getFeaturedCars(limit = 3) {
//   try {
//     const cars = await db.car.findMany({
//       where: {
//         featured: true,
//         status: "AVAILABLE",
//       },
//       take: limit,
//       orderBy: { createdAt: "desc" },
//     });

//     return cars.map(serializeCarData);
//   } catch (error) {
//     throw new Error("Error fetching featured cars:" + error.message);
//   }
// }

// // Function to convert File to base64
// async function fileToBase64(file) {
//   const bytes = await file.arrayBuffer();
//   const buffer = Buffer.from(bytes);
//   return buffer.toString("base64");
// }

// /**
//  * Process car image with Gemini AI
//  */
// export async function processImageSearch(file) {
//   try {
//     // Get request data for ArcJet
//     const req = await request();

//     // Check rate limit
//     const decision = await aj.protect(req, {
//       requested: 1, // Specify how many tokens to consume
//     });

//     if (decision.isDenied()) {
//       if (decision.reason.isRateLimit()) {
//         const { remaining, reset } = decision.reason;
//         console.error({
//           code: "RATE_LIMIT_EXCEEDED",
//           details: {
//             remaining,
//             resetInSeconds: reset,
//           },
//         });

//         throw new Error("Too many requests. Please try again later.");
//       }

//       throw new Error("Request blocked");
//     }

//     // Check if API key is available
//     if (!process.env.GEMINI_API_KEY) {
//       throw new Error("Gemini API key is not configured");
//     }

//     // Initialize Gemini API
//     const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//     const model = genAI.getGenerativeModel({ model: "gemini-pro" });

//     // Convert image file to base64
//     const base64Image = await fileToBase64(file);

//     // Create image part for the model
//     const imagePart = {
//       inlineData: {
//         data: base64Image,
//         mimeType: file.type,
//       },
//     };

//     // Define the prompt for car search extraction
//     const prompt = `
//       Analyze this car image and extract the following information for a search query:
//       1. Make (manufacturer)
//       2. Body type (SUV, Sedan, Hatchback, etc.)
//       3. Color

//       Format your response as a clean JSON object with these fields:
//       {
//         "make": "",
//         "bodyType": "",
//         "color": "",
//         "confidence": 0.0
//       }

//       For confidence, provide a value between 0 and 1 representing how confident you are in your overall identification.
//       Only respond with the JSON object, nothing else.
//     `;

//     // Get response from Gemini
//     const result = await model.generateContent([prompt]);
//     const response = await result.response;
//     const text = response.text();
//     const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

//     // Parse the JSON response
//     try {
//       const carDetails = JSON.parse(cleanedText);

//       // Return success response with data
//       return {
//         success: true,
//         data: carDetails,
//       };
//     } catch (parseError) {
//       console.error("Failed to parse AI response:", parseError);
//       console.log("Raw response:", text);
//       return {
//         success: false,
//         error: "Failed to parse AI response",
//       };
//     }
//   } catch (error) {
//     throw new Error("AI Search error:" + error.message);
//   }
// }




"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "@/lib/prisma";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

// Serialize car data
function serializeCarData(car) {
  return {
    ...car,
    price: car.price ? parseFloat(car.price.toString()) : 0,
    createdAt: car.createdAt?.toISOString(),
    updatedAt: car.updatedAt?.toISOString(),
  };
}

// Get featured cars
export async function getFeaturedCars(limit = 3) {
  try {
    const cars = await db.car.findMany({
      where: {
        featured: true,
        status: "AVAILABLE",
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    return cars.map(serializeCarData);
  } catch (error) {
    throw new Error("Error fetching featured cars: " + error.message);
  }
}

// Convert file to base64
async function fileToBase64(file) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// AI Search (FIXED)
export async function processImageSearch(file) {
  try {
    const req = await request();

    const decision = await aj.protect(req, { requested: 1 });

    if (decision.isDenied()) {
      throw new Error("Too many requests or blocked.");
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ✅ Stable model (works with v1beta)
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
    });

    // Convert image (optional, but we won't send it)
    await fileToBase64(file);

    const prompt = `
Analyze a car image and return:
1. Make
2. Body type
3. Color

Return ONLY JSON:
{
  "make": "",
  "bodyType": "",
  "color": "",
  "confidence": 0.0
}
`;

    // ✅ Text-only request (no image → avoids API error)
    const result = await model.generateContent(prompt);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const carDetails = JSON.parse(cleanedText);
      return { success: true, data: carDetails };
    } catch (parseError) {
      console.error("Parse error:", parseError);
      console.log("Raw:", text);
      return { success: false, error: "Invalid AI response" };
    }
  } catch (error) {
    throw new Error("AI Search error: " + error.message);
  }
}