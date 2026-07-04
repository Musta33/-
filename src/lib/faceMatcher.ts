import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) return;
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Use more accurate detector
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  modelsLoaded = true;
};

export const getFaceDescriptors = async (imageElement: HTMLImageElement) => {
  if (!modelsLoaded) {
    await loadModels();
  }
  // Detect all faces with a reasonable confidence threshold to allow varying distances but avoid false detections
  const detections = await faceapi.detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.30 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  
  return detections.map(d => d.descriptor);
};

export const findMatchingFace = async (
  targetImageSrc: string, 
  blocklist: any[]
): Promise<any | null> => {
  await loadModels();
  
  const targetImg = await loadImage(targetImageSrc);
  if (!targetImg) return null;
  
  const targetDescriptors = await getFaceDescriptors(targetImg);
  if (!targetDescriptors || targetDescriptors.length === 0) return null;
  
  // distance < 0.52 allows matching despite changes like baldness or facial hair, without being too loose.
  const labeledDescriptors = targetDescriptors.map((desc, i) => new faceapi.LabeledFaceDescriptors(`target_${i}`, [desc]));
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.52);

  for (const item of blocklist) {
    if (!item.imageUrl) continue;
    
    // We can skip matching if the image url is bad
    try {
      const itemImg = await loadImage(item.imageUrl);
      if (itemImg) {
        const itemDescriptors = await getFaceDescriptors(itemImg);
        if (itemDescriptors) {
          for (const itemDescriptor of itemDescriptors) {
            const match = faceMatcher.findBestMatch(itemDescriptor);
            if (match.label.startsWith('target_')) {
              // Convert Euclidean distance (0 to 0.52 threshold) into a confidence percentage (70% to 100%)
              const percentage = Math.round(((0.52 - match.distance) / 0.52) * 30 + 70);
              return { ...item, matchDistance: match.distance, matchPercentage: Math.min(100, Math.max(0, percentage)) };
            }
          }
        }
      }
    } catch(err) {
      // ignore image load errors
    }
  }
  
  return null;
};

// Helper function to load Image wrapped in Promise
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};
