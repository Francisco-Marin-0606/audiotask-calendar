import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

function getFileType(mime: string): string {
  if (mime.startsWith('image')) return 'image';
  if (mime.startsWith('video')) return 'video';
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/x-zip'
  )
    return 'zip';
  return 'audio';
}

export async function uploadFile(file: File): Promise<{
  url: string;
  name: string;
  type: string;
}> {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
  const storagePath = `uploads/${uniqueSuffix}${ext}`;

  const storageRef = ref(storage, storagePath);
  const metadata = { contentType: file.type };

  await uploadBytes(storageRef, file, metadata);
  const url = await getDownloadURL(storageRef);

  return {
    url,
    name: file.name,
    type: getFileType(file.type),
  };
}
