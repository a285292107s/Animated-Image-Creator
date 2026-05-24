export interface Frame {
  id: string;
  file: File;
  previewUrl: string;
  delay: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  fileSize: number;
  fileType: string;
}

export interface EditModalProps {
  frame: Frame;
  baseWidth: number;
  baseHeight: number;
  onSave: (id: string, x: number, y: number, scale: number, rotation: number) => void;
  onClose: () => void;
}
