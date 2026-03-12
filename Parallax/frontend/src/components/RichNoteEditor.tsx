import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, List, ListOrdered,
  Code, Image as ImageIcon, Check,
  AlignLeft, AlignCenter, AlignRight, Minus,
  Undo2, Redo2
} from 'lucide-react';
import './RichNoteEditor.css';

interface RichNoteEditorProps {
  initialTitle?: string;
  initialContent?: string;
  onSave: (title: string, htmlContent: string) => void;
}

export default function RichNoteEditor({ initialTitle = '', initialContent = '', onSave }: RichNoteEditorProps) {

  const [title, setTitle] = useState(initialTitle);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasContent, setHasContent] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const initializedRef = useRef(false);

  // Only set innerHTML ONCE on mount — never again. This prevents the cursor jump.
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      initializedRef.current = true;
      editorRef.current.innerHTML = initialContent;
      // Initial word check
      const text = editorRef.current.innerText || '';
      const html = editorRef.current.innerHTML || '';
      setHasContent(text.trim().length > 0 || html.includes('<img'));
      const words = text.replace(/[\n\r]+/g, ' ').trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get the clean HTML from the editor, stripping X-button containers for saving
  const getCleanHTML = useCallback((): string => {
    if (!editorRef.current) return '';
    const clone = editorRef.current.cloneNode(true) as HTMLElement;
    // For each image wrapper, replace with just the img
    clone.querySelectorAll('.note-img-wrapper').forEach(wrapper => {
      const img = wrapper.querySelector('img');
      if (img) {
        wrapper.replaceWith(img.cloneNode(true));
      } else {
        wrapper.remove();
      }
    });
    // Remove any lingering delete buttons
    clone.querySelectorAll('.note-img-delete-btn').forEach(btn => btn.remove());
    return clone.innerHTML;
  }, []);

  const triggerAutoSave = useCallback((newTitle: string, isNotEmpty: boolean) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (isNotEmpty || newTitle.trim() !== '') {
        onSave(newTitle.trim(), getCleanHTML());
      }
    }, 1200);
  }, [onSave, getCleanHTML]);

  const checkContent = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const html = editorRef.current.innerHTML || '';
      const isNotEmpty = text.trim().length > 0 || html.includes('<img');
      setHasContent(isNotEmpty);

      const words = text.replace(/[\n\r]+/g, ' ').trim().split(/\s+/).filter(word => word.length > 0);
      setWordCount(words.length);

      triggerAutoSave(title, isNotEmpty);
    }
  }, [title, triggerAutoSave]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    checkContent();
  }, [checkContent]);

  const handleFormat = useCallback((e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault();

    if (command === 'formatBlock') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node: Node | null = selection.getRangeAt(0).commonAncestorContainer;
        let isAlready = false;
        while (node && node !== editorRef.current) {
          if (node.nodeName === value) { isAlready = true; break; }
          node = node.parentNode;
        }
        if (isAlready) { execCommand('formatBlock', 'div'); return; }
      }
    }
    execCommand(command, value);
  }, [execCommand]);

  // Wrap an image element with a container that has an X delete button
  const wrapImageWithDeleteButton = useCallback((img: HTMLImageElement) => {
    // Don't double-wrap
    if (img.parentElement?.classList.contains('note-img-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'note-img-wrapper';
    wrapper.contentEditable = 'false';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-img-delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.type = 'button';
    deleteBtn.title = 'Remove image';
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.remove();
      checkContent();
    });

    img.parentNode?.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(deleteBtn);
  }, [checkContent]);

  // Wrap all existing images on mount + after insert
  const wrapAllImages = useCallback(() => {
    if (!editorRef.current) return;
    const images = editorRef.current.querySelectorAll('img');
    images.forEach(img => {
      wrapImageWithDeleteButton(img as HTMLImageElement);
    });
  }, [wrapImageWithDeleteButton]);

  // After initial load, wrap any existing images
  useEffect(() => {
    // Small delay to ensure innerHTML is set
    const t = setTimeout(() => wrapAllImages(), 50);
    return () => clearTimeout(t);
  }, [wrapAllImages]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl || !editorRef.current) return;

      // Restore focus to the editor
      editorRef.current.focus();

      // Create the image element
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Note image';

      // Insert at cursor position or at end
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        // Make sure the range is inside our editor
        if (editorRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          range.insertNode(img);
          // Move cursor after the image
          range.setStartAfter(img);
          range.setEndAfter(img);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          editorRef.current.appendChild(img);
        }
      } else {
        editorRef.current.appendChild(img);
      }

      // Add a line break after image for easier typing
      const br = document.createElement('br');
      img.parentNode?.insertBefore(br, img.nextSibling);

      // Wrap the image with delete button
      wrapImageWithDeleteButton(img);
      
      checkContent();
    };
    reader.readAsDataURL(file);
    
    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [checkContent, wrapImageWithDeleteButton]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    triggerAutoSave(newTitle, hasContent);
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+S → save immediately
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (hasContent || title.trim() !== '') {
        onSave(title.trim(), getCleanHTML());
      }
    }
    // Ctrl+Z → undo
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      execCommand('undo');
    }
    // Ctrl+Shift+Z or Ctrl+Y → redo
    if (((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      execCommand('redo');
    }
  }, [hasContent, title, onSave, execCommand, getCleanHTML]);

  return (
    <div className="rich-editor-container" onKeyDown={handleKeyDown}>
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('undo'); }} className="toolbar-btn" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('redo'); }} className="toolbar-btn" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button onMouseDown={(e) => handleFormat(e, 'bold')} className="toolbar-btn" title="Bold (Ctrl+B)">
            <Bold size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'italic')} className="toolbar-btn" title="Italic (Ctrl+I)">
            <Italic size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'underline')} className="toolbar-btn" title="Underline (Ctrl+U)">
            <Underline size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'strikeThrough')} className="toolbar-btn" title="Strikethrough">
            <Strikethrough size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'H1')} className="toolbar-btn" title="Heading 1">
            <Heading1 size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'formatBlock', 'H2')} className="toolbar-btn" title="Heading 2">
            <Heading2 size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button onMouseDown={(e) => handleFormat(e, 'insertUnorderedList')} className="toolbar-btn" title="Bullet List">
            <List size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'insertOrderedList')} className="toolbar-btn" title="Numbered List">
            <ListOrdered size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button onMouseDown={(e) => handleFormat(e, 'justifyLeft')} className="toolbar-btn" title="Align Left">
            <AlignLeft size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'justifyCenter')} className="toolbar-btn" title="Align Center">
            <AlignCenter size={16} />
          </button>
          <button onMouseDown={(e) => handleFormat(e, 'justifyRight')} className="toolbar-btn" title="Align Right">
            <AlignRight size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button onMouseDown={(e) => handleFormat(e, 'insertHorizontalRule')} className="toolbar-btn" title="Divider">
            <Minus size={16} />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('formatBlock', 'pre'); }} className="toolbar-btn" title="Code Block">
            <Code size={16} />
          </button>
          <button className="toolbar-btn" title="Insert Image" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={handleImageUpload}
          />
        </div>
      </div>

      <div className="editor-title-container">
        <input
          type="text"
          className="editor-title-input"
          placeholder="Note Title"
          value={title}
          onChange={handleTitleChange}
        />
      </div>

      <div
        className="editor-content body-large"
        contentEditable
        ref={editorRef}
        onInput={checkContent}
        data-placeholder="Start writing your idea..."
        spellCheck
      />

      <div className="editor-footer">
        <span className="word-count body-small text-muted">{wordCount} words</span>
        <div className="editor-footer-actions">
           <span className="body-small text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={14} /> Saved automatically
           </span>
        </div>
      </div>
    </div>
  );
}
