export function extractDominantColor(imageUrl) {
  return new Promise((resolve) => {
    // Nếu không có URL hoặc URL lỗi, trả về màu mặc định
    if (!imageUrl) {
      resolve('32, 32, 32');
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      // Render kích thước nhỏ để tính cho lẹ
      canvas.width = 32;
      canvas.height = 32;
      
      try {
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0;
        let count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i];
          const green = data[i + 1];
          const blue = data[i + 2];
          
          // Bỏ qua các pixel quá đen hoặc quá trắng để lấy màu sắc đặc trưng
          if (
            (red > 250 && green > 250 && blue > 250) || 
            (red < 15 && green < 15 && blue < 15)
          ) {
            continue;
          }
          
          r += red;
          g += green;
          b += blue;
          count++;
        }
        
        if (count === 0) {
          resolve('32, 32, 32');
          return;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        resolve(`${r}, ${g}, ${b}`);
      } catch (err) {
        console.warn('Cannot extract color due to CORS or Canvas error', err);
        resolve('32, 32, 32');
      }
    };
    
    img.onerror = () => {
      resolve('32, 32, 32');
    };
    
    img.src = imageUrl;
  });
}
