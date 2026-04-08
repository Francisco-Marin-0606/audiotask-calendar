import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collaborator, SavedContact } from '@/src/types';
import { useContacts } from '@/src/hooks/useContacts';
import { auth } from '@/src/lib/firebase';
import { Search, X, UserPlus, Loader2, Users } from 'lucide-react';

interface CollaboratorPickerProps {
  selected: Collaborator[];
  onChange: (collaborators: Collaborator[]) => void;
}

export function CollaboratorPicker({ selected, onChange }: CollaboratorPickerProps) {
  const { contacts, searchUserByEmail } = useContacts();
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SavedContact | null | 'not-found'>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearch = useCallback(async (email: string) => {
    setSearchEmail(email);
    setSearchResult(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchUserByEmail(trimmed);
        if (!result) {
          setSearchResult('not-found');
        } else if (result.uid === auth.currentUser?.uid) {
          setSearchResult('not-found');
        } else {
          setSearchResult(result);
        }
      } catch {
        setSearchResult('not-found');
      } finally {
        setSearching(false);
      }
    }, 500);
  }, [searchUserByEmail]);

  const addCollaborator = (contact: SavedContact | Collaborator) => {
    if (selected.some(c => c.uid === contact.uid)) return;
    if (contact.uid === auth.currentUser?.uid) return;
    onChange([...selected, {
      uid: contact.uid,
      email: contact.email,
      displayName: contact.displayName,
      photoURL: contact.photoURL,
    }]);
    setSearchEmail('');
    setSearchResult(null);
  };

  const removeCollaborator = (uid: string) => {
    onChange(selected.filter(c => c.uid !== uid));
  };

  const filteredContacts = contacts.filter(c =>
    c.uid !== auth.currentUser?.uid &&
    !selected.some(s => s.uid === c.uid)
  );

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Users size={16} className="text-primary" />
        Colaboradores
      </Label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(c => (
            <Badge
              key={c.uid}
              variant="secondary"
              className="flex items-center gap-2 py-1.5 px-3 text-sm"
            >
              {c.photoURL ? (
                <img src={c.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                  {(c.displayName || c.email)[0]?.toUpperCase()}
                </div>
              )}
              <span className="truncate max-w-[120px]">{c.displayName || c.email}</span>
              <button type="button" onClick={() => removeCollaborator(c.uid)} className="text-muted-foreground hover:text-destructive ml-1">
                <X size={14} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por email..."
          value={searchEmail}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
        {searching && (
          <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {searchResult && searchResult !== 'not-found' && (
        <button
          type="button"
          onClick={() => addCollaborator(searchResult)}
          className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
        >
          {searchResult.photoURL ? (
            <img src={searchResult.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
              {(searchResult.displayName || searchResult.email)[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{searchResult.displayName || 'Sin nombre'}</p>
            <p className="text-xs text-muted-foreground truncate">{searchResult.email}</p>
          </div>
          <UserPlus size={16} className="text-primary shrink-0" />
        </button>
      )}

      {searchResult === 'not-found' && searchEmail.includes('@') && (
        <p className="text-xs text-muted-foreground px-1">
          No se encontró un usuario con ese email. El usuario debe tener cuenta en la app.
        </p>
      )}

      {!searchEmail && filteredContacts.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Colaboradores recientes</p>
          <ScrollArea className="max-h-[140px]">
            <div className="space-y-1">
              {filteredContacts.slice(0, 8).map(c => (
                <Button
                  key={c.uid}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start gap-3 h-auto py-2 px-3"
                  onClick={() => addCollaborator(c)}
                >
                  {c.photoURL ? (
                    <img src={c.photoURL} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {(c.displayName || c.email)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium truncate">{c.displayName || 'Sin nombre'}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
