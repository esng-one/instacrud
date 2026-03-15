// app/(admin)/(others-pages)/ai-assistant/utils/imageUtils.ts
import toast from "react-hot-toast";

// Helper function to sanitize base64 strings for logging
export function sanitizeBase64ForLogging(value: any): any {
  if (typeof value === 'string' && value.includes('base64,')) {
    const parts = value.split('base64,');
    if (parts[1] && parts[1].length > 7) {
      return `${parts[0]}base64,${parts[1].substring(0, 7)}...`;
    }
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeBase64ForLogging(item));
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: any = {};
    for (const key in value) {
      sanitized[key] = sanitizeBase64ForLogging(value[key]);
    }
    return sanitized;
  }
  return value;
}

// Convert image file to base64
export const imageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 data without the data URL prefix
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Copy image to clipboard
export const handleCopyImage = async (imageUrl: string) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob })
    ]);
    toast.success('Image copied to clipboard');
  } catch (err) {
    console.error('Failed to copy image:', err);
    toast.error('Failed to copy image');
  }
};

// Save image to downloads
export const handleSaveImage = async (imageUrl: string, fileName: string = 'image.png') => {
  try {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Image saved');
  } catch (err) {
    console.error('Failed to save image:', err);
    toast.error('Failed to save image');
  }
};

// Prompt with image (feed to vision model)
export const fetchAndConvertImage = async (imageUrl: string): Promise<{ data: string; url: string }> => {
  // All images are now stored as base64 data URLs
  // If it's already a data URL, extract the base64 data directly
  if (imageUrl.startsWith('data:image/')) {
    const base64Data = imageUrl.split(',')[1];
    // Create object URL for display
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    return { data: base64Data, url: objectUrl };
  } else {
    // For any other URL, fetch and convert
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const file = new File([blob], 'image.png', { type: blob.type });
    const base64Data = await imageToBase64(file);
    const objectUrl = URL.createObjectURL(blob);
    return { data: base64Data, url: objectUrl };
  }
};
