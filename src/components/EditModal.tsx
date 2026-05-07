import React, { useState, useEffect } from 'react';
import type { ImageFile } from "../App";

interface EditModalProps {
  image: ImageFile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
}

const backgroundOptions = [
  { id: 'color', label: '纯色' },
  { id: 'image', label: '图片' }
];

const effectOptions = [
  { id: 'none', label: '无' },
  { id: 'blur', label: '模糊' },
  { id: 'brightness', label: '亮度' },
  { id: 'contrast', label: '对比度' }
];

const predefinedColors = [
  '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#00ffff', '#ff00ff', '#808080', '#c0c0c0'
];

const predefinedPatterns = [
  { id: 'dots', label: '圆点' },
  { id: 'lines', label: '线条' },
  { id: 'grid', label: '网格' },
  { id: 'waves', label: '波纹' }
];

export function EditModal({ image, isOpen, onClose, onSave }: EditModalProps) {
  const [bgType, setBgType] = useState('color');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [customBgImage, setCustomBgImage] = useState<File | null>(null);
  const [selectedEffect, setSelectedEffect] = useState('none');
  const [blurValue, setBlurValue] = useState(50);
  const [brightnessValue, setBrightnessValue] = useState(50);
  const [contrastValue, setContrastValue] = useState(50);
  const [exportUrl, setExportUrl] = useState('');
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);

  const processedURL = image.processedFile ? URL.createObjectURL(image.processedFile) : '';

  useEffect(() => {
    if (image.processedFile) {
      applyChanges();
    }
  }, [bgType, bgColor, customBgImage, selectedEffect, blurValue, brightnessValue, contrastValue]);

  const getCurrentEffectValue = () => {
    switch (selectedEffect) {
      case 'blur':
        return blurValue;
      case 'brightness':
        return brightnessValue;
      case 'contrast':
        return contrastValue;
      default:
        return 50;
    }
  };

  const handleEffectValueChange = (value: number) => {
    switch (selectedEffect) {
      case 'blur':
        setBlurValue(value);
        break;
      case 'brightness':
        setBrightnessValue(value);
        break;
      case 'contrast':
        setContrastValue(value);
        break;
    }
  };

  const applyChanges = async () => {
    if (!image.processedFile) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.src = processedURL;
    await new Promise(resolve => img.onload = resolve);
    
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Apply background
    if (bgType === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bgType === 'image' && customBgImage) {
      const bgImg = new Image();
      bgImg.src = URL.createObjectURL(customBgImage);
      await new Promise(resolve => bgImg.onload = resolve);
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw the processed image
    ctx.drawImage(img, 0, 0);
    
    // Apply effects
    if (selectedEffect !== 'none') {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      switch (selectedEffect) {
        case 'blur':
          // Create a temporary canvas for blur effect
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (!tempCtx) break;
          
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          
          // Draw current state to temp canvas
          tempCtx.drawImage(canvas, 0, 0);
          
          // Clear main canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Apply blur using CSS filter
          ctx.filter = `blur(${blurValue / 10}px)`;
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.filter = 'none';
          break;
          
        case 'brightness':
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * (brightnessValue / 50));
            data[i + 1] = Math.min(255, data[i + 1] * (brightnessValue / 50));
            data[i + 2] = Math.min(255, data[i + 2] * (brightnessValue / 50));
          }
          ctx.putImageData(imageData, 0, 0);
          break;
          
        case 'contrast':
          const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
          for (let i = 0; i < data.length; i += 4) {
            data[i] = factor * (data[i] - 128) + 128;
            data[i + 1] = factor * (data[i + 1] - 128) + 128;
            data[i + 2] = factor * (data[i + 2] - 128) + 128;
          }
          ctx.putImageData(imageData, 0, 0);
          break;
      }
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    setExportUrl(dataUrl);
  };

  const handleSave = () => {
    onSave(exportUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/98 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-rose-100 shadow-soft">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent">
            编辑图像
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-xl leading-none w-8 h-8 rounded-lg hover:bg-rose-50"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-stone-700 mb-2">背景</h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {backgroundOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setBgType(option.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                      bgType === option.id
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'bg-rose-50 text-stone-700 hover:bg-rose-100/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {bgType === 'color' && (
                <div>
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {predefinedColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setBgColor(color)}
                        className="w-8 h-8 rounded-full border border-rose-100 shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setShowCustomColorPicker(!showCustomColorPicker)}
                      className="px-3 py-1.5 bg-white border border-rose-100 rounded-xl hover:bg-rose-50/80 transition-colors text-sm text-stone-700"
                    >
                      自定义颜色
                    </button>
                    {showCustomColorPicker && (
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="w-8 h-8 border border-rose-200 rounded-lg cursor-pointer"
                      />
                    )}
                  </div>
                </div>
              )}

              {bgType === 'image' && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCustomBgImage(e.target.files?.[0] || null)}
                  className="w-full text-sm text-stone-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-rose-50 file:text-rose-700"
                />
              )}
            </div>

            <div>
              <h3 className="font-medium text-stone-700 mb-2">效果</h3>
              <div className="flex gap-2 mb-4 flex-wrap">
                {effectOptions.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedEffect(option.id)}
                    className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                      selectedEffect === option.id
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-orange-50/80 text-stone-700 hover:bg-orange-100/80'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {selectedEffect !== 'none' && (
                <div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={getCurrentEffectValue()}
                    onChange={(e) => handleEffectValueChange(Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                  <div className="flex justify-between text-sm text-stone-500">
                    <span>0</span>
                    <span>{getCurrentEffectValue()}</span>
                    <span>100</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-stone-700 mb-2">预览</h3>
            <div className="border border-rose-100 rounded-xl overflow-hidden bg-checkered">
              <img
                src={exportUrl || processedURL}
                alt="预览"
                className="w-full object-contain"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-700 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-rose-500 rounded-xl hover:bg-rose-600 transition-colors shadow-sm"
          >
            保存更改
          </button>
        </div>
      </div>
    </div>
  );
}
