import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Palette, Upload, Eye, Monitor, Smartphone, Save, AlertCircle, CheckCircle2, X, FileImage } from "lucide-react";

// Utility function to generate favicon from logo
const generateFaviconFromLogo = (logoFile: File): Promise<File> => {
  console.log('🚀 FAVICON: Starting favicon generation from logo:', logoFile.name);
  
  return new Promise((resolve, reject) => {
    console.log('🚀 FAVICON: Creating Image object...');
    const img = new Image();
    
    img.onload = () => {
      console.log('🚀 FAVICON: Image loaded successfully:', {
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
      
      try {
        console.log('🚀 FAVICON: Creating canvas for favicon generation...');
        // Create canvas for favicon generation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          console.error('🚀 FAVICON: Failed to get canvas context');
          reject(new Error('Could not get canvas context'));
          return;
        }

        console.log('🚀 FAVICON: Canvas context created successfully');

        // Set favicon size (32x32 is a good standard)
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        console.log(`🚀 FAVICON: Canvas size set to ${size}x${size}`);

        // Fill with transparent background
        ctx.clearRect(0, 0, size, size);

        // Calculate scaling to fit the image into the favicon while maintaining aspect ratio
        const scale = Math.min(size / img.width, size / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (size - scaledWidth) / 2;
        const y = (size - scaledHeight) / 2;

        console.log('🚀 FAVICON: Scaling calculations:', {
          scale,
          scaledWidth,
          scaledHeight,
          x,
          y
        });

        // Draw the logo centered and scaled
        console.log('🚀 FAVICON: Drawing image on canvas...');
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        console.log('🚀 FAVICON: Image drawn successfully');

        // Convert to blob and then to File
        console.log('🚀 FAVICON: Converting canvas to blob...');
        canvas.toBlob((blob) => {
          console.log('🚀 FAVICON: Canvas.toBlob callback called, blob:', blob);
          
          if (blob) {
            const faviconFile = new File([blob], 'favicon.png', { type: 'image/png' });
            console.log('🎨 FAVICON: Generated favicon from logo successfully:', {
              originalSize: `${img.width}x${img.height}`,
              faviconSize: `${size}x${size}`,
              fileSize: `${(blob.size / 1024).toFixed(1)}KB`,
              faviconFile: faviconFile
            });
            resolve(faviconFile);
          } else {
            console.error('🚀 FAVICON: toBlob returned null');
            reject(new Error('Failed to generate favicon blob'));
          }
        }, 'image/png');
      } catch (error) {
        console.error('🚀 FAVICON: Error in favicon generation:', error);
        reject(error);
      }
    };
    
    img.onerror = (error) => {
      console.error('🚀 FAVICON: Image failed to load:', error);
      reject(new Error('Failed to load logo image'));
    };
    
    console.log('🚀 FAVICON: Setting image src with object URL...');
    img.src = URL.createObjectURL(logoFile);
    console.log('🚀 FAVICON: Object URL set:', img.src);
  });
};

// Zod schema for branding configuration - URLs optional, no validation
const brandingSchema = z.object({
  institutionName: z.string().min(1, "Institution name is required").max(100, "Institution name must be less than 100 characters"),
  title: z.string().min(1, "Title is required").max(150, "Title must be less than 150 characters"),
  logoUrl: z.string().optional(), // Keep for backend compatibility, no validation
  faviconUrl: z.string().optional(), // Keep for backend compatibility, no validation
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #1e3a8a)"),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #1e40af)"),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #3b82f6)"),
  loginScreenBackgroundColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #f8fafc)"),
  loginScreenAccentColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #1e3a8a)"),
  loginScreenTextColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #1f2937)"),
  loginScreenHeroColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Please enter a valid hex color (e.g., #002147)"),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

interface BrandingSettingsProps {
  onConfigUpdate?: (_config: BrandingFormData) => void;
}

// File upload component - UPLOAD ONLY, NO URL INPUTS
const FileUploadField: React.FC<{
  label: string;
  description: string;
  currentUrl?: string;
  onFileSelect: (_file: File) => void | Promise<void>;
  accept: string;
  type: 'logo' | 'favicon';
}> = ({ label, description, currentUrl, onFileSelect, accept, type }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState(currentUrl || '');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setPreviewUrl(currentUrl || '');
  }, [currentUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(`🚀 UPLOAD: handleFileChange triggered for ${type}`);
    const file = e.target.files?.[0];
    console.log('🚀 UPLOAD: Selected file:', file ? { 
      name: file.name, 
      type: file.type, 
      size: `${(file.size / 1024).toFixed(1)}KB`
    } : 'No file');
    
    if (file) {
      console.log(`🚀 UPLOAD: Setting processing state to true for ${type}`);
      setIsProcessing(true);
      
      // Create preview URL immediately
      console.log('🚀 UPLOAD: Creating preview URL...');
      const objectUrl = URL.createObjectURL(file);
      console.log('🚀 UPLOAD: Preview URL created:', objectUrl);
      setPreviewUrl(objectUrl);
      
      try {
        console.log(`🚀 UPLOAD: Calling onFileSelect callback for ${type}...`);
        console.log(`🚀 UPLOAD: onFileSelect function:`, onFileSelect);
        
        // Call the file selection handler
        const result = onFileSelect(file);
        console.log(`🚀 UPLOAD: onFileSelect returned:`, result);
        
        // Handle both sync and async results
        if (result instanceof Promise) {
          console.log(`🚀 UPLOAD: Awaiting promise result for ${type}...`);
          await result;
          console.log(`🚀 UPLOAD: Promise resolved for ${type}`);
        } else {
          console.log(`🚀 UPLOAD: Synchronous result for ${type}`);
        }
        
        console.log(`✅ UPLOAD: ${type} file processed successfully:`, file.name);
      } catch (error) {
        console.error(`❌ UPLOAD: Failed to process ${type} file:`, error);
        console.error(`❌ UPLOAD: Error details:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
      } finally {
        console.log(`🚀 UPLOAD: Setting processing state to false for ${type}`);
        setIsProcessing(false);
      }
    } else {
      console.log(`🚀 UPLOAD: No file selected for ${type}`);
    }
  };

  const clearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPreviewUrl('');
    // Revoke the object URL to free memory
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      
      <div className="space-y-3">
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isProcessing 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => {
            console.log('🖱️ Upload area clicked, processing:', isProcessing);
            if (!isProcessing) {
              console.log('📁 Triggering file input click');
              fileInputRef.current?.click();
            }
          }}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
              <p className="mt-2 text-sm text-blue-600">Processing {type}...</p>
            </div>
          ) : (
            <>
              <FileImage className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Click to upload {type} or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {type === 'favicon' ? 'ICO, PNG, SVG (up to 5MB)' : 'PNG, JPG, SVG (up to 5MB)'}
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          disabled={isProcessing}
        />
      </div>
      
      {/* Preview */}
      {previewUrl && (
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-shrink-0">
            {type === 'favicon' ? (
              <div className="w-8 h-8 border border-gray-200 rounded bg-white flex items-center justify-center">
                <img 
                  src={previewUrl} 
                  alt="Favicon preview" 
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    console.error('Failed to load favicon preview:', previewUrl);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-16 h-16 border border-gray-200 rounded bg-white flex items-center justify-center">
                <img 
                  src={previewUrl} 
                  alt="Logo preview" 
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    console.error('Failed to load logo preview:', previewUrl);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {type === 'favicon' ? 'Favicon' : 'Logo'} Preview
            </p>
            <p className="text-xs text-gray-500 truncate">
              {previewUrl.startsWith('blob:') ? 'Local file' : previewUrl}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearFile}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
};

// Color picker component
const ColorPicker: React.FC<{
  value: string;
  onChange: (color: string) => void;
  label: string;
  description?: string;
}> = ({ value, onChange, label, description }) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex items-center space-x-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-10 rounded-md border-2 border-gray-300 cursor-pointer"
          />
          <Palette className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-white mix-blend-difference pointer-events-none" />
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm flex-1"
        />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
};

// Preview component
const BrandingPreview: React.FC<{ config: BrandingFormData }> = ({ config }) => {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-card">
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Monitor className="w-4 h-4 mr-2" />
          Navigation Bar Preview
        </h4>
        <div 
          className="w-full h-16 rounded-md flex items-center px-4 text-white"
          style={{ backgroundColor: config.primaryColor }}
        >
          <div className="flex items-center space-x-3">
            {config.logoUrl && (
              <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                <img 
                  src={config.logoUrl} 
                  alt="Logo" 
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <span className="font-semibold">{config.institutionName}</span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Smartphone className="w-4 h-4 mr-2" />
          Login Screen Preview
        </h4>
        <div 
          className="w-full h-32 rounded-md flex items-center justify-center p-4"
          style={{ backgroundColor: config.loginScreenBackgroundColor }}
        >
          <div className="text-center space-y-2">
            <h3 
              className="font-bold text-lg"
              style={{ color: config.loginScreenTextColor }}
            >
              {config.institutionName}
            </h3>
            <p 
              className="text-sm opacity-75"
              style={{ color: config.loginScreenTextColor }}
            >
              {config.title}
            </p>
            <div 
              className="w-20 h-8 rounded text-white text-xs flex items-center justify-center font-medium mx-auto"
              style={{ backgroundColor: config.loginScreenAccentColor }}
            >
              Login
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-lg border bg-card">
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Smartphone className="w-4 h-4 mr-2" />
          Hero Section Preview
        </h4>
        <div 
          className="w-full h-32 rounded-md flex items-center justify-center p-4 text-white"
          style={{ backgroundColor: config.loginScreenHeroColor }}
        >
          <div className="text-center space-y-1">
            <h3 className="font-bold text-lg">
              Streamline Regulatory Compliance
            </h3>
            <div className="text-sm space-y-1">
              <div>✓ Centralized compliance tracking</div>
              <div>✓ Automated deadline notifications</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export function BrandingSettingsV2({ onConfigUpdate }: BrandingSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ logo?: File; favicon?: File }>({});

  // Fetch current branding configuration
  const { data: brandingData, isLoading, error } = useQuery({
    queryKey: ["/api/admin/branding"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/branding");
      return response.branding;
    },
  });

  // Form setup - URLs hidden from user interface
  const form = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      institutionName: "",
      title: "",
      logoUrl: "",
      faviconUrl: "",
      primaryColor: "#1e3a8a",
      secondaryColor: "#1e40af",
      accentColor: "#3b82f6",
      loginScreenBackgroundColor: "#f8fafc",
      loginScreenAccentColor: "#1e3a8a",
      loginScreenTextColor: "#1f2937",
      loginScreenHeroColor: "#002147",
    },
    mode: "onChange", // Enable real-time validation
  });

  // Update form when branding data is loaded
  useEffect(() => {
    if (brandingData) {
      form.reset({
        institutionName: brandingData.institutionName || "",
        title: brandingData.title || "",
        logoUrl: brandingData.logoUrl || "",
        faviconUrl: brandingData.faviconUrl || "",
        primaryColor: brandingData.primaryColor || "#1e3a8a",
        secondaryColor: brandingData.secondaryColor || "#1e40af",
        accentColor: brandingData.accentColor || "#3b82f6",
        loginScreenBackgroundColor: brandingData.loginScreenBackgroundColor || "#f8fafc",
        loginScreenAccentColor: brandingData.loginScreenAccentColor || "#1e3a8a",
        loginScreenTextColor: brandingData.loginScreenTextColor || "#1f2937",
        loginScreenHeroColor: brandingData.loginScreenHeroColor || "#002147",
      });
      
      // Clear any validation errors after loading data
      form.clearErrors();
    }
  }, [brandingData, form]);

  // Watch for form changes
  const watchedValues = form.watch();
  useEffect(() => {
    if (brandingData) {
      const hasFormChanges = Object.keys(watchedValues).some(
        (key) => watchedValues[key as keyof BrandingFormData] !== brandingData[key as keyof BrandingFormData]
      );
      setHasChanges(hasFormChanges || Object.keys(pendingFiles).length > 0);
    }
  }, [watchedValues, brandingData, pendingFiles]);

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: { logo?: File; favicon?: File }) => {
      const formData = new FormData();
      if (files.logo) formData.append('logo', files.logo);
      if (files.favicon) formData.append('favicon', files.favicon);
      
      const response = await fetch('/api/uploads/branding', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (response) => {
      // Update form with uploaded asset URLs
      const currentValues = form.getValues();
      const newValues = { ...currentValues };
      
      if (response.assets.logoUrl) {
        newValues.logoUrl = response.assets.logoUrl;
        form.setValue('logoUrl', response.assets.logoUrl);
      }
      
      if (response.assets.faviconUrl) {
        newValues.faviconUrl = response.assets.faviconUrl;
        form.setValue('faviconUrl', response.assets.faviconUrl);
      }
      
      setPendingFiles({});
      
      toast({
        title: "Files Uploaded",
        description: "Your branding assets have been uploaded successfully.",
        duration: 3000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BrandingFormData) => {
      // First upload files if any
      if (Object.keys(pendingFiles).length > 0) {
        const uploadResponse = await uploadMutation.mutateAsync(pendingFiles);
        // Update data with uploaded URLs
        if (uploadResponse.assets.logoUrl) {
          data.logoUrl = uploadResponse.assets.logoUrl;
        }
        if (uploadResponse.assets.faviconUrl) {
          data.faviconUrl = uploadResponse.assets.faviconUrl;
        }
      }
      
      return await apiRequest("POST", "/api/admin/branding", data);
    },
    onSuccess: (response) => {
      console.log('🎨 Branding save successful, updating cache immediately:', response.branding);
      
      // Option A: Immediate cache update + forced refetch
      // 1. Immediately update cache with saved data (no waiting for refetch)
      queryClient.setQueryData(["/api/branding"], response.branding);
      queryClient.setQueryData(["/api/admin/branding"], { success: true, branding: response.branding });
      
      // 2. Force refetch to ensure data is fresh from server (bypasses staleTime)
      queryClient.refetchQueries({ queryKey: ["/api/branding"], type: 'active' });
      queryClient.refetchQueries({ queryKey: ["/api/admin/branding"], type: 'active' });
      
      console.log('🔄 Cache updated and refetch forced for branding data');
      
      toast({
        title: "Branding Updated",
        description: "Your branding configuration has been saved successfully.",
        duration: 5000,
      });
      setHasChanges(false);
      setPendingFiles({});
      onConfigUpdate?.(response.branding);
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save branding configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BrandingFormData) => {
    saveMutation.mutate(data);
  };

  const handleFileSelect = async (type: 'logo' | 'favicon', file: File) => {
    console.log(`🚀 HANDLE: handleFileSelect called with type="${type}", file:`, {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(1)}KB`
    });
    
    console.log(`🚀 HANDLE: Current pendingFiles state:`, pendingFiles);
    
    // Update pending files with the selected file
    console.log(`🚀 HANDLE: Updating pendingFiles state to add ${type} file...`);
    setPendingFiles(prev => {
      const newState = { ...prev, [type]: file };
      console.log(`🚀 HANDLE: New pendingFiles state will be:`, newState);
      return newState;
    });
    
    // Auto-generate favicon from logo if this is a logo upload and no custom favicon exists
    if (type === 'logo') {
      console.log('🚀 HANDLE: This is a logo upload, checking if we should generate favicon...');
      
      const currentFaviconUrl = form.getValues('faviconUrl');
      const currentPendingFiles = pendingFiles;
      
      // More permissive logic: generate favicon unless there's already a pending favicon
      // or unless the user has explicitly uploaded a custom favicon file (not blob/default)
      const isDefaultOrGenerated = !currentFaviconUrl || 
                                   currentFaviconUrl === '/favicon.ico' ||
                                   currentFaviconUrl.startsWith('blob:') ||
                                   currentFaviconUrl.includes('institution-favicon');
      
      console.log('🚀 HANDLE: Favicon check details:', {
        currentFaviconUrl,
        currentFaviconUrl_type: typeof currentFaviconUrl,
        isDefaultOrGenerated,
        breakdown: {
          isEmpty: !currentFaviconUrl,
          isDefaultFavicon: currentFaviconUrl === '/favicon.ico',
          isBlobUrl: currentFaviconUrl?.startsWith('blob:'),
          isGeneratedFavicon: currentFaviconUrl?.includes('institution-favicon')
        },
        currentPendingFiles,
        hasPendingFavicon: !!currentPendingFiles.favicon,
        shouldGenerateFavicon: isDefaultOrGenerated && !currentPendingFiles.favicon,
        form_faviconUrl: form.getValues('faviconUrl'),
        reasoning: !isDefaultOrGenerated ? 'Custom favicon already exists' : 
                  currentPendingFiles.favicon ? 'Favicon already pending' : 'Conditions met'
      });
      
      // Generate favicon if no custom favicon exists and no favicon is pending
      if (isDefaultOrGenerated && !currentPendingFiles.favicon) {
        console.log('🚀 HANDLE: Conditions met for favicon generation! Starting process...');
        
        try {
          console.log('🚀 HANDLE: Calling generateFaviconFromLogo...');
          const generatedFavicon = await generateFaviconFromLogo(file);
          
          console.log('✅ HANDLE: Favicon generated successfully:', {
            originalFile: file.name,
            faviconSize: `${(generatedFavicon.size / 1024).toFixed(1)}KB`,
            generatedFavicon
          });
          
          // Update pending files with generated favicon
          console.log('🚀 HANDLE: Updating pendingFiles state to add generated favicon...');
          setPendingFiles(prev => {
            const newState = {
              ...prev,
              favicon: generatedFavicon
            };
            console.log('🚀 HANDLE: New pendingFiles state after favicon generation:', newState);
            return newState;
          });
          
          // Create a blob URL for the generated favicon to show immediate preview
          const faviconBlobUrl = URL.createObjectURL(generatedFavicon);
          console.log('🚀 HANDLE: Created favicon blob URL for preview:', faviconBlobUrl);
          
          // Set the blob URL as the current favicon URL to trigger preview update
          form.setValue('faviconUrl', faviconBlobUrl);
          console.log('🚀 HANDLE: Updated form faviconUrl to trigger preview update');
          
          console.log('🚀 HANDLE: Showing success toast...');
          toast({
            title: "Favicon Generated",
            description: "A favicon has been automatically generated from your logo.",
            duration: 3000,
          });
          
          console.log('🚀 HANDLE: Favicon generation process completed successfully!');
        } catch (error) {
          console.error('❌ HANDLE: Failed to generate favicon from logo:', error);
          console.error('❌ HANDLE: Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          // Don't show error toast, as this is a nice-to-have feature
        }
              } else {
        console.log('🚀 HANDLE: Conditions NOT met for favicon generation. Reasons:', {
          isDefaultOrGenerated,
          hasPendingFavicon: !!currentPendingFiles.favicon,
          reasoning: !isDefaultOrGenerated ? 'Custom favicon exists' : 'Already has pending favicon'
        });
      }
    } else {
      console.log('🚀 HANDLE: This is not a logo upload, skipping favicon generation');
    }
    
    console.log('🚀 HANDLE: handleFileSelect completed');
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" />
          <span className="ml-2">Loading branding configuration...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load branding configuration. Please refresh the page and try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="h-5 w-5 text-blue-600" />
              <CardTitle>Institution Branding</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
          </div>
          <CardDescription>
            Customize your institution's visual identity across the entire application.
            Changes will be applied to the login screen, navigation, and all user interfaces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="institutionName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institution Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Moravian University" {...field} />
                        </FormControl>
                        <FormDescription>
                          The name of your institution as it appears throughout the application.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Application Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Moravian University Compliance Portal" {...field} />
                        </FormControl>
                        <FormDescription>
                          The title shown in browser tabs and the login screen.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Logo and Assets */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Logo and Assets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Upload Only - No URL Fields */}
                  <div>
                    <FileUploadField
                      label="Logo"
                      description="Your institution's logo. Used in navigation and login screens."
                      currentUrl={form.watch('logoUrl')}
                      onFileSelect={(file) => handleFileSelect('logo', file)}
                      accept="image/*"
                      type="logo"
                    />
                  </div>

                  <div>
                    <FileUploadField
                      label="Favicon"
                      description={
                        pendingFiles.favicon && !form.watch('faviconUrl') 
                          ? "Auto-generated from your logo. You can replace this by uploading a custom favicon."
                          : "Appears in browser tabs and bookmarks."
                      }
                      currentUrl={form.watch('faviconUrl')}
                      onFileSelect={(file) => handleFileSelect('favicon', file)}
                      accept="image/*,.ico"
                      type="favicon"
                    />
                    {pendingFiles.favicon && !form.watch('faviconUrl') && (
                      <div className="mt-2 flex items-center text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Favicon automatically generated from logo
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Application Colors */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Application Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="primaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Primary Color"
                          description="Main navigation and primary buttons"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="secondaryColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Secondary Color"
                          description="Secondary buttons and highlights"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accentColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Accent Color"
                          description="Links and interactive elements"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Login Screen Colors */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Login Screen Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <FormField
                    control={form.control}
                    name="loginScreenBackgroundColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Background Color"
                          description="Login screen background"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loginScreenAccentColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Login Button Color"
                          description="Login button and form accents"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loginScreenTextColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Text Color"
                          description="Login screen text and labels"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="loginScreenHeroColor"
                    render={({ field }) => (
                      <FormItem>
                        <ColorPicker
                          value={field.value}
                          onChange={field.onChange}
                          label="Hero Section Color"
                          description="Colored rectangle behind features list"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {hasChanges && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You have unsaved changes. Click "Save Branding Configuration" to apply your changes.
                  </AlertDescription>
                </Alert>
              )}

              {/* Save Button */}
              <div className="flex justify-end space-x-3">
                <Button 
                  type="submit"
                  disabled={!hasChanges || saveMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  {saveMutation.isPending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saveMutation.isPending ? 'Saving...' : 'Save Branding Configuration'}</span>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      {previewMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Eye className="h-5 w-5 mr-2" />
              Live Preview
            </CardTitle>
            <CardDescription>
              See how your changes will look across the application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandingPreview config={watchedValues} />
          </CardContent>
        </Card>
      )}
    </div>
  );
} 