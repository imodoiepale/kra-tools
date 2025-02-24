// @ts-nocheck
"use client"

import { useEffect, useState, useCallback } from "react";
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button";
import { FolderPlus, File } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FileObject {
  name: string;
  id?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
    cacheControl?: string;
    lastModified?: Date;
  };
  path: string;
  type: 'file' | 'folder';
  created_at?: string;
  updated_at?: string;
  last_accessed_at?: string;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface SidebarItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: SidebarItem[];
  isOpen?: boolean;
}

export default function StorageDashboard() {
  const [buckets, setBuckets] = useState<any[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [files, setFiles] = useState<FileObject[]>([]);
  const [totalSize, setTotalSize] = useState<number>(0);
  const [savedStorage, setSavedStorage] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const sanitizePath = (path: string): string => {
    return path.replace(/\/+/g, '/').trim().replace(/^\/|\/$/g, '');
  };

  const buildSidebarTree = async (bucketName: string, path: string = ""): Promise<SidebarItem[]> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) throw error;
      if (!data) return [];

      const itemPromises = data.map(async (item) => {
        const itemPath = path ? `${path}/${item.name}` : item.name;
        const isFolder = !item.id && !item.metadata;

        const sidebarItem: SidebarItem = {
          name: item.name,
          path: itemPath,
          type: isFolder ? 'folder' : 'file',
          isOpen: false
        };

        if (isFolder) {
          sidebarItem.children = await buildSidebarTree(bucketName, itemPath);
        }

        return sidebarItem;
      });

      const items = await Promise.all(itemPromises);
      return items;
    } catch (err) {
      console.error('Error building sidebar tree:', err);
      return [];
    }
  };

  const SidebarTree = ({ items, level = 0 }: { items: SidebarItem[], level?: number }) => {
    const toggleFolder = async (item: SidebarItem) => {
      if (item.type === 'folder') {
        setSidebarItems(current => {
          const newItems = [...current];
          const findAndToggle = (items: SidebarItem[]): boolean => {
            for (let i = 0; i < items.length; i++) {
              if (items[i].path === item.path) {
                items[i].isOpen = !items[i].isOpen;
                return true;
              }
              if (items[i].children) {
                if (findAndToggle(items[i].children!)) return true;
              }
            }
            return false;
          };
          findAndToggle(newItems);
          return newItems;
        });
        setCurrentPath(item.path);
      } else {
        setSelectedFile(item.path);
        setCurrentPath(item.path);
      }
    };

    return (
      <ul className={cn("space-y-1", level > 0 && "ml-4")}>
        {items.map((item) => (
          <li key={item.path}>
            <button
              onClick={() => toggleFolder(item)}
              className={cn(
                "flex items-center w-full py-1 px-2 rounded-md text-sm",
                "hover:bg-gray-100 transition-colors",
                item.path === selectedFile && "bg-blue-50 text-blue-700",
                level > 0 && "text-sm"
              )}
            >
              {item.type === 'folder' ? (
                <FolderPlus className="h-4 w-4 mr-2" />
              ) : (
                <File className="h-4 w-4 mr-2" />
              )}
              <span className="truncate">{item.name}</span>
            </button>
            {item.type === 'folder' && item.isOpen && item.children && (
              <SidebarTree items={item.children} level={level + 1} />
            )}
          </li>
        ))}
      </ul>
    );
  };

  const fetchFiles = useCallback(async (bucketName: string, path: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(path, {
          limit: 100,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) throw error;
      if (!data) return;

      const formattedFiles = data.map((item) => ({
        ...item,
        name: item.name,
        path: path ? `${path}/${item.name}` : item.name,
        type: (!item.id && !item.metadata) ? 'folder' : 'file',
      }));

      const validFiles = formattedFiles.filter(item =>
        item.type === 'file' || (item.type === 'folder' && !item.name.includes('.'))
      );

      setFiles(validFiles);
      await calculateTotalSize(validFiles.filter(item => item.type === 'file'));
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateTotalSize = async (files: FileObject[]) => {
    let total = 0;
    try {
      const sizePromises = files.map(async (file) => {
        if (file.type !== 'file') return 0;
        if (file.metadata?.size) return file.metadata.size;

        try {
          const { data: fileData } = await supabase.storage
            .from(selectedBucket!)
            .getPublicUrl(file.path);

          if (fileData?.publicUrl) {
            const response = await fetch(fileData.publicUrl, { method: 'HEAD' });
            return parseInt(response.headers.get('content-length') || '0');
          }
          return 0;
        } catch (err) {
          console.error(`Error getting size for ${file.path}:`, err);
          return 0;
        }
      });

      const sizes = await Promise.all(sizePromises);
      total = sizes.reduce((acc, size) => acc + size, 0);
      setTotalSize(total / (1024 * 1024)); // Convert to MB
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate size');
    }
  };

  async function compressImage(file: Blob): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const width = img.width * 0.8;
        const height = img.height * 0.8;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob!),
          'image/jpeg',
          0.7
        );
      };
    });
  }

  async function compressAndUpload() {
    if (!selectedBucket) return;
    setLoading(true);
    setError(null);

    try {
      const fileOps = files
        .filter(file => file.type === 'file')
        .map(async (file) => {
          try {
            const { data, error } = await supabase.storage
              .from(selectedBucket)
              .download(file.path);

            if (error || !data) {
              console.error(`Error downloading ${file.path}:`, error);
              return { original: 0, compressed: 0 };
            }

            const originalSize = data.size;
            const fileType = file.name.split('.').pop()?.toLowerCase();

            let compressedData: Blob = data;
            if (['jpg', 'jpeg', 'png'].includes(fileType || '')) {
              compressedData = await compressImage(data);
            }

            const compressedPath = currentPath
              ? `compressed/${currentPath}/${file.name}`
              : `compressed/${file.name}`;

            await supabase.storage
              .from(selectedBucket)
              .upload(sanitizePath(compressedPath), compressedData, { upsert: true });

            return {
              original: originalSize,
              compressed: compressedData.size
            };
          } catch (fileErr) {
            console.error(`Error processing ${file.path}:`, fileErr);
            return { original: 0, compressed: 0 };
          }
        });

      const results = await Promise.all(fileOps);
      const totals = results.reduce(
        (acc, curr) => ({
          original: acc.original + curr.original,
          compressed: acc.compressed + curr.compressed
        }),
        { original: 0, compressed: 0 }
      );

      const savedSpace = (totals.original - totals.compressed) / (1024 * 1024);
      setSavedStorage(savedSpace);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Compression failed');
    } finally {
      setLoading(false);
    }
  }

  const handleBucketSelect = async (bucketName: string) => {
    setSidebarLoading(true);
    try {
      setSelectedBucket(bucketName);
      setCurrentPath("");
      const tree = await buildSidebarTree(bucketName);
      setSidebarItems(tree);
    } finally {
      setSidebarLoading(false);
    }
  };

  useEffect(() => {
    fetchBuckets();
  }, []);

  async function fetchBuckets() {
    setLoading(true);
    setError(null);
    try {
      const { data: bucketList, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      setBuckets(bucketList);

      if (bucketList.length > 0) {
        const tree = await buildSidebarTree(bucketList[0].name);
        setSidebarItems(tree);
      }
    } catch (err) {
      console.error('Error fetching buckets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch buckets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedBucket && !loading) {
      fetchFiles(selectedBucket, currentPath);
      updateBreadcrumbs();
    }
  }, [selectedBucket, currentPath, fetchFiles]);

  const updateBreadcrumbs = () => {
    if (!currentPath) {
      setBreadcrumbs([]);
      return;
    }
    const pathParts = currentPath.split('/');
    let builtPath = "";
    const newBreadcrumbs = pathParts.map(part => {
      builtPath = builtPath ? `${builtPath}/${part}` : part;
      return { name: part, path: builtPath };
    });
    setBreadcrumbs(newBreadcrumbs);
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(sanitizePath(path));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 py-4 px-3">
        <h2 className="text-lg font-semibold mb-2">Storage Buckets</h2>
        <ScrollArea className="h-[calc(100vh-100px)]">
          <nav className="flex flex-col space-y-1">
            {buckets.map((bucket) => (
              <button
                key={bucket.name}
                className={cn(
                  "flex items-center py-2 px-3 rounded-md text-sm font-medium w-full",
                  "hover:bg-gray-100 transition-colors",
                  selectedBucket === bucket.name ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-700"
                )}
                onClick={() => handleBucketSelect(bucket.name)}
              >
                {bucket.name}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      <main className="flex-1 p-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}

        {(loading || sidebarLoading) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-md">
              <span className="loading loading-spinner"></span>
              <span className="ml-2">Processing...</span>
            </div>
          </div>
        )}

        {selectedBucket ? (
          <div className="flex gap-4">
            <div className="w-1/3 bg-white rounded-lg shadow">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">File Explorer</h2>
              </div>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-4">
                  <SidebarTree items={sidebarItems} />
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1">
              <div className="mb-4 flex items-center space-x-4">
                <h1 className="text-2xl font-bold">
                  Bucket: {selectedBucket}
                </h1>
                <Button
                  onClick={compressAndUpload}
                  disabled={loading}
                >
                  {loading ? "Compressing..." : "Compress Files"}
                </Button>
                <p className="text-green-600">
                  Storage Saved: {savedStorage.toFixed(2)} MB
                </p>
              </div>
              <p>Total Size: {totalSize.toFixed(2)} MB</p>
              <Separator className="mb-4" />

              <div className="mb-4 flex items-center">
                <Button
                  variant="link"
                  onClick={() => setCurrentPath("")}
                  className="text-blue-600"
                >
                  Root
                </Button>
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center">
                    <span className="mx-2">/</span>
                    <Button
                      variant="link"
                      onClick={() => navigateToPath(crumb.path)}
                      className="text-blue-600"
                    >
                      {crumb.name}
                    </Button>
                  </div>
                ))}
              </div>
              <Separator className="mb-4" />

              <div className="border rounded-md shadow-sm bg-white">
                <div className="p-4 font-semibold border-b border-gray-200">
                  Current Directory Contents
                </div>
                <ScrollArea className="p-4 h-[calc(100vh-400px)]">
                  <ul>
                    {files.map((file) => (
                      <li key={file.name} className="flex items-center space-x-2 py-1">
                        {file.type === 'folder' ? (
                          <FolderPlus className="h-4 w-4 text-gray-400" />
                        ) : (
                          <File className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="text-sm">{file.name}</span>
                        {file.type === 'file' && (
                          <span className="text-xs text-gray-500">
                            ({(file.metadata?.size || 0) / 1024} KB)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Select a bucket from the sidebar.</div>
        )}
      </main>
    </div>
  );
}