// ═══════════════════════════════════════════════════════════
// WARRIOR OS — Notes Archive App
// Markdown notes with wiki-links, search, and persistence
// ═══════════════════════════════════════════════════════════

'use client';

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotesList } from './NotesList';
import { MarkdownEditor } from './MarkdownEditor';
import { SearchPanel } from './SearchPanel';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('warrior-notes') || '[]');
  } catch { return []; }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem('warrior-notes', JSON.stringify(notes));
}

function NotesAppInner() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  const createNote = () => {
    const note: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveNotes(updated);
    setActiveNoteId(note.id);
  };

  const updateNote = (id: string, changes: Partial<Note>) => {
    const updated = notes.map((n) =>
      n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
    );
    setNotes(updated);
    saveNotes(updated);
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const navigateToNote = (title: string) => {
    const target = notes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase()
    );
    if (target) {
      setActiveNoteId(target.id);
    } else {
      // Create new note with that title
      const note: Note = {
        id: `note-${Date.now()}`,
        title,
        content: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [note, ...notes];
      setNotes(updated);
      saveNotes(updated);
      setActiveNoteId(note.id);
    }
  };

  return (
    <div className="flex h-full bg-black/30">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-white/10 bg-black/20 flex flex-col">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-bold text-amber-400">📒 Notes</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 text-xs"
              title="Search"
            >
              🔍
            </button>
            <button
              onClick={createNote}
              className="w-7 h-7 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 text-xs"
              title="New note"
            >
              +
            </button>
          </div>
        </div>

        {showSearch && (
          <SearchPanel
            notes={notes}
            onSelect={(id) => {
              setActiveNoteId(id);
              setShowSearch(false);
            }}
          />
        )}

        <NotesList
          notes={notes}
          activeNoteId={activeNoteId}
          onSelect={setActiveNoteId}
          onDelete={deleteNote}
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeNote ? (
            <motion.div
              key={activeNote.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <MarkdownEditor
                note={activeNote}
                onUpdate={(changes) => updateNote(activeNote.id, changes)}
                onNavigate={navigateToNote}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex items-center justify-center"
            >
              <div className="text-center space-y-3">
                <p className="text-4xl">📝</p>
                <p className="text-sm text-white/40">
                  Select a note or create a new one
                </p>
                <button
                  onClick={createNote}
                  className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm"
                >
                  + New Note
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export const NotesApp = memo(NotesAppInner);
