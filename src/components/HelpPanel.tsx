import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import '../App.css';

interface HelpPanelProps {
  onClose: () => void;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '800px', height: 'auto', padding: '2rem' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>使用帮助</h3>
          <button className="close-modal-btn" onClick={onClose} aria-label="关闭帮助"><X size={24} /></button>
        </div>

        <div style={{ color: 'var(--text-primary)', lineHeight: 1.8, overflowY: 'auto', maxHeight: '70vh', paddingRight: '0.5rem' }}>
          <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--accent-color)' }}>📥 导入文件</h4>
          <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            <li>拖拽图片/视频文件到虚线区域，或点击虚线区域浏览文件</li>
            <li>支持格式：PNG、JPG、WebP、GIF、AVIF、APNG、MP4</li>
            <li>支持批量导入多帧（APNG/GIF/AVIF/WebP/MP4 会自动拆分为多帧）</li>
            <li>第一个导入的图片自动成为基准帧（定义画布尺寸）</li>
          </ul>

          <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--accent-color)' }}>🖼️ 帧管理</h4>
          <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            <li>拖拽帧卡片可以调整帧的顺序</li>
            <li>点击非基准帧的预览图可以进入编辑模式，调整位置、缩放和旋转</li>
            <li>每帧可单独设置延时（毫秒）</li>
            <li>点击右上角 ✕ 按钮可移除单帧</li>
          </ul>

          <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--accent-color)' }}>🎯 智能对齐</h4>
          <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            <li>点击"智能对齐"按钮，会自动将较大的图片等比缩放至基准帧尺寸</li>
            <li>适用于不同分辨率的图片快速对齐</li>
          </ul>

          <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--accent-color)' }}>🎬 生成动画</h4>
          <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            <li>点击 APNG 按钮生成 APNG 格式动画（支持透明通道）</li>
            <li>点击 WebP 按钮生成 WebP 格式动画（适合网页使用）</li>
            <li>生成后可调整压缩参数重新生成，或切换到另一种格式</li>
            <li>修改文件名后点击"下载"按钮保存到本地</li>
          </ul>

          <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--accent-color)' }}>🎨 其他功能</h4>
          <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem', color: 'var(--text-secondary)' }}>
            <li>右上角月亮/太阳图标可切换深色/浅色主题</li>
            <li>右上角 GitHub 图标可查看项目源码</li>
            <li>全局延时设置会统一修改所有帧的延时</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;
