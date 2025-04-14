const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { cloudinary } = require('../utils/cloudinary');
const { generateUniqueFilename } = require('../utils/fileHelpers');
require('dotenv').config();

// Initialize Gemini API
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Helper function to process image URLs and create image parts
const processImageUrl = async (url) => {
  try {
    if (url.startsWith('file://')) {
      // For file:// URLs, read the file as binary data
      const response = await axios.get(url, { 
        responseType: 'arraybuffer',
        headers: { 'Accept': 'image/*' }
      });
      
      return {
        inlineData: {
          data: Buffer.from(response.data).toString('base64'),
          mimeType: "image/jpeg"
        }
      };
    } else {
      // For http/https URLs
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      
      return {
        inlineData: {
          data: Buffer.from(response.data).toString('base64'),
          mimeType: "image/jpeg"
        }
      };
    }
  } catch (error) {
    console.error(`Error processing image ${url}:`, error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
};

// Generate AI image using Gemini
exports.generateImage = async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ message: 'Please provide a prompt for image generation' });
    }
    
    console.log(`Generating image with prompt: ${prompt}`);
    
    // Create a profile-oriented prompt
    const enhancedPrompt = `Create a high-quality realistic square profile picture of a person with these characteristics: ${prompt}. Make it suitable for a social media profile picture with good lighting and composition.`;

    try {
      // Use the correct model based on the latest Gemini documentation
      const model = genAI.getModel("gemini-2.0-flash-exp-image-generation");

      // Generate content with image generation capability
      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
        generationConfig: {
          responseModalities: ['Text', 'Image']
        }
      });
      
      // Check if we have a successful response with image data
      const result = response.response;
      let imageData = null;
      let description = "";
      
      if (result && result.candidates && result.candidates[0]?.content?.parts) {
        const parts = result.candidates[0].content.parts;
        
        // Extract text and image data
        for (const part of parts) {
          if (part.text) {
            description += part.text;
          } else if (part.inlineData) {
            imageData = part.inlineData.data;
          }
        }
      }
      
      // If we have image data, save it to a file
      if (imageData) {
        const tempFolder = path.join(__dirname, '../temp');
        
        // Ensure the temp directory exists
        if (!fs.existsSync(tempFolder)) {
          fs.mkdirSync(tempFolder, { recursive: true });
        }
        
        // Generate a unique filename
        const filename = generateUniqueFilename('ai-profile', 'png');
        const tempFilePath = path.join(tempFolder, filename);
        
        // Save the image to a file
        fs.writeFileSync(tempFilePath, Buffer.from(imageData, 'base64'));
        
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
          folder: 'ai-generated-profiles',
          resource_type: 'image',
          transformation: [
            {width: 400, height: 400, crop: "fill", gravity: "center"}
          ]
        });
        
        // Clean up the temporary file
        fs.unlinkSync(tempFilePath);
        
        // Return the image URL to the client
        return res.status(200).json({
          success: true,
          imageUrl: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          prompt: prompt,
          description: description.substring(0, 100) + "..."
        });
      } else {
        throw new Error("No image data returned from Gemini API");
      }
    } catch (genError) {
      console.error('Specific Gemini API error:', genError);
      
      // Fallback to a generic profile image if Gemini API fails
      const tempFolder = path.join(__dirname, '../temp');
      
      // Ensure the temp directory exists
      if (!fs.existsSync(tempFolder)) {
        fs.mkdirSync(tempFolder, { recursive: true });
      }
      
      // Generate a unique filename
      const filename = generateUniqueFilename('ai-profile', 'png');
      const tempFilePath = path.join(tempFolder, filename);
      
      // Use a placeholder from UI Avatars - it's more reliable
      const profilePlaceholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(prompt.substring(0, 20))}&size=400&background=random`;
      
      // Download the placeholder image
      const placeholderResponse = await axios.get(profilePlaceholder, { responseType: 'arraybuffer' });
      fs.writeFileSync(tempFilePath, Buffer.from(placeholderResponse.data));
      
      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
        folder: 'ai-generated-profiles',
        resource_type: 'image',
        transformation: [
          {width: 400, height: 400, crop: "fill", gravity: "center"},
          {overlay: {font_family: "Arial", font_size: 18, text: prompt.substring(0, 50) + "..."}, 
           gravity: "south", y: 20, color: "#FFFFFF"}
        ]
      });
      
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath);
      
      // Return the placeholder image
      return res.status(200).json({
        success: true,
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        prompt: prompt,
        note: "Using placeholder image due to AI generation error"
      });
    }
  } catch (error) {
    console.error('Error generating image:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate image'
    });
  }
};

// Delete an image from Cloudinary
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.body;
    
    if (!publicId) {
      return res.status(400).json({ message: 'Please provide a public ID for image deletion' });
    }
    
    console.log(`Deleting image with publicId: ${publicId}`);
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result !== 'ok') {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete image from Cloudinary',
        result
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      result
    });
    
  } catch (error) {
    console.error('Error deleting image:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete image'
    });
  }
};

// Extract image content and generate caption using Gemini Vision
exports.analyzeImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'Please provide an image URL for analysis' });
    }
    
    console.log(`Analyzing image from URL: ${imageUrl}`);
    
    // Process the image
    const imagePart = await processImageUrl(imageUrl);
    
    // Generate content
    const prompt = "Analyze this image and describe what you see in detail, focusing on the subject, setting, mood, and visual elements.";
    
    const response = await genAI.models.generateContent({
      model: "gemini-pro-vision",
      contents: [
        {
          role: "user",
          parts: [imagePart, { text: prompt }]
        }
      ]
    });
    
    return res.status(200).json({
      success: true,
      analysis: response.text
    });
    
  } catch (error) {
    console.error('Error analyzing image:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to analyze image'
    });
  }
};

// Generate caption for multiple images
exports.generateCaption = async (req, res) => {
  try {
    const { imageUrls } = req.body;
    
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one image URL' });
    }
    
    console.log(`Generating caption for ${imageUrls.length} images`);
    
    // Process up to 5 images (Gemini's limit)
    const imagesToProcess = imageUrls.slice(0, 5);
    
    // Process all images in parallel
    const imagePartsPromises = imagesToProcess.map(url => processImageUrl(url));
    const imageParts = await Promise.all(imagePartsPromises);
    
    // Add the prompt text
    const prompt = "Based on these images, create an engaging and creative Instagram-style caption that would appeal to social media users. The caption should be 1-2 sentences, catchy, relatable, and suitable for social media. Don't use hashtags in the caption.";
    
    // Prepare parts for the API call
    const parts = [...imageParts, { text: prompt }];
    
    // Generate content
    const response = await genAI.models.generateContent({
      model: "gemini-pro-vision",
      contents: [
        {
          role: "user",
          parts: parts
        }
      ]
    });
    
    return res.status(200).json({
      success: true,
      caption: response.text.trim()
    });
    
  } catch (error) {
    console.error('Error generating caption:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate caption'
    });
  }
};

// Generate tags for post based on images and caption
exports.generateTags = async (req, res) => {
  try {
    const { imageUrls, caption } = req.body;
    
    if ((!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) && !caption) {
      return res.status(400).json({ message: 'Please provide at least one image URL or a caption' });
    }
    
    console.log(`Generating tags for post with ${imageUrls ? imageUrls.length : 0} images and caption: "${caption}"`);
    
    const parts = [];
    
    // If we have images, process them (up to 3 to leave room for text)
    if (imageUrls && imageUrls.length > 0) {
      const imagesToProcess = imageUrls.slice(0, 3);
      
      // Process all images in parallel
      const imagePartsPromises = imagesToProcess.map(url => processImageUrl(url));
      const imageParts = await Promise.all(imagePartsPromises);
      parts.push(...imageParts);
    }
    
    // Craft the prompt for structured output
    let prompt = "Based on ";
    if (imageUrls && imageUrls.length > 0) {
      prompt += "these images";
      if (caption) prompt += " and the following caption: \"" + caption + "\"";
    } else {
      prompt += "the following caption: \"" + caption + "\"";
    }
    
    prompt += ", generate 10 relevant hashtags for Instagram or social media. Return only the hashtags as a JSON array of strings, without the # symbol. The response MUST be valid JSON that can be parsed with JSON.parse. Example output format: [\"tag1\", \"tag2\", \"tag3\"]";
    
    parts.push({ text: prompt });
    
    // Generate content with structured output format
    const response = await genAI.models.generateContent({
      model: "gemini-pro-vision",
      contents: [{ role: "user", parts: parts }],
      generationConfig: {
        temperature: 0.2
      }
    });
    
    const tagsText = response.text;
    
    // Parse the response to extract tags
    let tags;
    try {
      // Clean the response - remove markdown code blocks and any other text
      const cleanedText = tagsText.replace(/```json|```|\n/g, '').trim();
      tags = JSON.parse(cleanedText);
    } catch (e) {
      console.error('Error parsing JSON response:', e);
      
      // Fallback: Try to extract tags with regex
      const tagMatches = tagsText.match(/"([^"]+)"/g) || [];
      tags = tagMatches.map(tag => tag.replace(/"/g, ''));
      
      // If that also fails, use simple text splitting
      if (tags.length === 0) {
        tags = tagsText.split(/,|\n/).map(tag => {
          return tag.replace(/#|"|'|\[|\]/g, '').trim();
        }).filter(tag => tag.length > 0);
      }
    }
    
    // Ensure we have an array and limit to 10 tags
    if (!Array.isArray(tags)) {
      tags = [tags].filter(Boolean);
    }
    
    // Limit to 10 tags and ensure no tags start with #
    tags = tags.slice(0, 10).map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
    
    return res.status(200).json({
      success: true,
      tags
    });
    
  } catch (error) {
    console.error('Error generating tags:', error);
    
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate tags'
    });
  }
}; 