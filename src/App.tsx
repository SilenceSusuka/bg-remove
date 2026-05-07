import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Images } from "./components/Images";
import { processImages, initializeModel, getModelInfo } from "../lib/process";

interface AppError {
  message: string;
}

export interface ImageFile {
  id: number;
  file: File;
  processedFile?: File;
}

// Check if the user is on mobile Safari
const isMobileSafari = () => {
  const ua = window.navigator.userAgent;
  const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i);
  const webkit = !!ua.match(/WebKit/i);
  const iOSSafari = iOS && webkit && !ua.match(/CriOS/i) && !ua.match(/OPiOS/i) && !ua.match(/FxiOS/i);
  return iOSSafari && 'ontouchend' in document;
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [isWebGPU, setIsWebGPU] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [currentModel, setCurrentModel] = useState<'briaai/RMBG-1.4' | 'Xenova/modnet'>('briaai/RMBG-1.4');
  const [isModelSwitching, setIsModelSwitching] = useState(false);
  const [images, setImages] = useState<ImageFile[]>([]);

  useEffect(() => {
    if (isMobileSafari()) {
      window.location.href = 'https://bg-mobile.addy.ie';
      return;
    }

    // Only check iOS on load since that won't change
    const { isIOS: isIOSDevice } = getModelInfo();
    setIsIOS(isIOSDevice);
    setIsLoading(false);
  }, []);

  const handleModelChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = event.target.value as typeof currentModel;
    setIsModelSwitching(true);
    setError(null);
    try {
      const initialized = await initializeModel(newModel);
      if (!initialized) {
        throw new Error("无法初始化新模型");
      }
      setCurrentModel(newModel);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Falling back")) {
        setCurrentModel('briaai/RMBG-1.4');
      } else {
        setError({
          message: err instanceof Error ? err.message : "切换模型失败",
        });
      }
    } finally {
      setIsModelSwitching(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newImages = acceptedFiles.map((file, index) => ({
      id: Date.now() + index,
      file,
      processedFile: undefined
    }));
    setImages(prev => [...prev, ...newImages]);
    
    // Initialize model if this is the first image
    if (images.length === 0) {
      setIsLoading(true);
      setError(null);
      try {
        const initialized = await initializeModel();
        if (!initialized) {
          throw new Error("背景移除模型加载失败");
        }
        // Update WebGPU support status after model initialization
        const { isWebGPUSupported } = getModelInfo();
        setIsWebGPU(isWebGPUSupported);
      } catch (err) {
        setError({
          message: err instanceof Error ? err.message : "发生未知错误",
        });
        setImages([]); // Clear the newly added images if model fails to load
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }
    
    for (const image of newImages) {
      try {
        const result = await processImages([image.file]);
        if (result && result.length > 0) {
          setImages(prev => prev.map(img =>
            img.id === image.id
              ? { ...img, processedFile: result[0] }
              : img
          ));
        }
      } catch (error) {
        console.error('Error processing image:', error);
      }
    }
  }, [images.length]);


  const handlePaste = async (event: React.ClipboardEvent) => {
    const clipboardItems = event.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of clipboardItems) {
      if (item.type.startsWith("image")) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      onDrop(imageFiles);
    }
  };  

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp", ".mp4"],
    },
  });

  const modelLabel =
    currentModel === "briaai/RMBG-1.4" ? "RMBG-1.4" : "MODNet";

  return (
    <div className="min-h-screen flex flex-col" onPaste={handlePaste}>
      <nav className="sticky top-0 z-40 h-14 shrink-0 border-b border-rose-100/80 bg-white/90 backdrop-blur-md">
        <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/favicon.png"
              alt=""
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-rose-100 shrink-0"
              width={32}
              height={32}
            />
            <h1 className="text-sm sm:text-base font-bold bg-gradient-to-r from-rose-600 to-orange-500 bg-clip-text text-transparent truncate">
              松坂砂糖的图像处理站
            </h1>
          </div>
          {!isIOS && (
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="model-select" className="sr-only">
                选择模型
              </label>
              <select
                id="model-select"
                value={currentModel}
                onChange={handleModelChange}
                className="bg-white border border-rose-100 rounded-lg px-2.5 py-1 text-sm font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-200 max-w-[9.5rem] sm:max-w-none disabled:opacity-60"
                disabled={isModelSwitching}
                title="切换抠图模型（支持 WebGPU 时可选用 MODNet）"
              >
                <option value="briaai/RMBG-1.4">RMBG-1.4</option>
                {isWebGPU && (
                  <option value="Xenova/modnet">MODNet</option>
                )}
              </select>
            </div>
          )}
          {isIOS && (
            <span className="text-xs font-medium text-stone-500 truncate">
              iOS 优化模式
            </span>
          )}
        </div>
      </nav>

      <div
        className="relative w-full h-[160px] sm:h-[180px] md:h-[200px] lg:h-[220px] overflow-hidden border-b border-rose-100/50 shrink-0 bg-rose-50/30"
        aria-hidden
      >
        <img
          src="/banner.png"
          alt=""
          className="absolute left-1/2 top-0 h-[115%] w-full min-w-full -translate-x-1/2 object-cover object-[center_12%] opacity-[0.38]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/55 to-[#fff8fb]" />
      </div>

      <main className="flex-1 w-full px-4 sm:px-6 py-10 md:py-12 flex flex-col items-stretch">
        <div className="w-full max-w-2xl mx-auto flex flex-col">
          {images.length === 0 && (
            <header className="text-center mb-8 space-y-2">
              <h2 className="text-2xl sm:text-[26px] font-bold text-stone-800 tracking-tight">
                去掉背景，留下角色本身
              </h2>
              <p className="text-sm sm:text-base text-stone-500">
                浏览器本地处理，不上传服务器
              </p>
            </header>
          )}

          {images.length > 0 && (
            <p className="text-center text-sm text-stone-500 mb-4">
              可继续拖入或点击上传，添加更多图片
            </p>
          )}

          <div {...getRootProps()} className="w-full max-w-lg mx-auto">
          <div
            className={`rounded-2xl border-2 border-dashed px-8 py-10 text-center cursor-pointer transition-all duration-300 ease-in-out bg-white/95 shadow-soft backdrop-blur-sm
                ${isDragAccept ? "border-emerald-400 bg-emerald-50/80" : ""}
                ${isDragReject ? "border-red-400 bg-red-50/70" : ""}
                ${
                  isDragActive
                    ? "border-rose-400 bg-rose-50/70 ring-2 ring-rose-100"
                    : "border-rose-200/90 hover:border-rose-300 hover:bg-rose-50/30"
                }
                ${isLoading || isModelSwitching ? "cursor-not-allowed opacity-75" : ""}
              `}
          >
            <input
              {...getInputProps()}
              className="hidden"
              disabled={isLoading || isModelSwitching}
            />
            <div className="flex flex-col items-center gap-3">
              {isLoading || isModelSwitching ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-2 border-rose-400 border-t-transparent" />
                  <p className="text-stone-600 text-sm">
                    {isModelSwitching
                      ? "正在切换模型…"
                      : "正在加载抠图模型…"}
                  </p>
                </>
              ) : error ? (
                <>
                  <svg
                    className="w-10 h-10 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-red-600 text-sm font-medium">
                    {error.message}
                  </p>
                  {currentModel === "Xenova/modnet" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleModelChange({
                          target: { value: "briaai/RMBG-1.4" },
                        } as React.ChangeEvent<HTMLSelectElement>);
                      }}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs hover:bg-rose-600"
                    >
                      改用 RMBG-1.4
                    </button>
                  )}
                </>
              ) : (
                <>
                  <svg
                    className="w-11 h-11 text-rose-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-stone-800 font-medium">
                    {isDragActive
                      ? "松开即可上传"
                      : "拖入图片，或点击上传"}
                  </p>
                  <p className="text-xs sm:text-sm text-stone-400 tracking-wide">
                    PNG / JPG / WEBP
                  </p>
                  <p className="text-xs text-stone-400">
                    也可{" "}
                    <kbd className="px-1 py-0.5 rounded border border-stone-200 bg-stone-50 text-stone-500">
                      Ctrl+V
                    </kbd>{" "}
                    粘贴图片
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        {images.length > 0 && (
          <div className="w-full max-w-6xl mx-auto mt-10 lg:mt-12 lg:px-2">
            <Images
              images={images}
              onDelete={(id) =>
                setImages((prev) => prev.filter((img) => img.id !== id))
              }
            />
          </div>
        )}

        <footer className="mt-12 pt-8 border-t border-rose-100/70 text-center text-xs sm:text-sm text-stone-500 space-y-3 max-w-lg mx-auto w-full px-2">
          <p>
            <span className="text-stone-600 font-medium">当前模型</span>
            ：{modelLabel}
            {!isIOS && isWebGPU && "（可在顶部切换 MODNet / WebGPU）"}
            {!isIOS && !isWebGPU && "（跨浏览器通用）"}
            {isIOS && "（已针对 Safari 优化）"}
          </p>
          <p className="leading-relaxed">
            <span className="text-stone-600 font-medium">隐私与本地</span>
            ：图片仅在您的浏览器内运算与暂存，不会上传到服务器；关闭页面后请及时下载留存。
          </p>
          <p className="text-stone-400 text-[11px] sm:text-xs">
            基于 Transformers.js · 感谢 Addy Osmani 等开源贡献
          </p>
        </footer>
      </main>
    </div>
  );
}
