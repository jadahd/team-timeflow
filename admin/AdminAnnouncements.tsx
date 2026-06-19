import { useState } from 'react';
import { Announcement } from '@/types/workforce';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Megaphone, Pencil } from 'lucide-react';
import { toast } from 'sonner';

// Default lifetimes for the quick "Add" input.
const DEFAULT_EXPIRATION_HOURS = 48;

export const AdminAnnouncements = () => {
  const { announcements, refresh } = useAnnouncements();
  const [newText, setNewText] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);

  const handleAdd = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const created = await createAnnouncement({
      text: trimmed,
      priority: 'normal',
      expiresAt: new Date(Date.now() + DEFAULT_EXPIRATION_HOURS * 60 * 60 * 1000).toISOString(),
    });
    if (!created) {
      toast.error('Could not add announcement.');
      return;
    }
    setNewText('');
    toast.success('Announcement added');
    await refresh();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const ok = await deleteAnnouncement(pendingDelete.id);
    if (ok) {
      toast.success('Announcement deleted');
      await refresh();
    } else {
      toast.error('Could not delete announcement.');
    }
    setPendingDelete(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Announcements</h1>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Type a new announcement..."
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Quick add — defaults to normal priority and expires in {DEFAULT_EXPIRATION_HOURS} hours.
            Click an announcement's pencil icon to edit priority or expiration.
          </p>
        </CardContent>
      </Card>

      {announcements.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No active announcements. Add one above — it'll appear on the kiosk ticker.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((ann) => (
            <Card key={ann.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <Megaphone
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    ann.priority === 'urgent' ? 'text-destructive' : 'text-accent'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{ann.text}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={ann.priority === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {ann.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Expires {new Date(ann.expiresAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <EditAnnouncementDialog announcement={ann} onSaved={refresh} />
                  <button
                    onClick={() => setPendingDelete(ann)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    aria-label="Delete announcement"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              It will immediately disappear from the kiosk ticker. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ----------------------------------------------------------------
// Inline edit dialog. Lets admin tweak text, priority, expiration.
// ----------------------------------------------------------------
interface EditAnnouncementDialogProps {
  announcement: Announcement;
  onSaved: () => void;
}

const EditAnnouncementDialog = ({ announcement, onSaved }: EditAnnouncementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(announcement.text);
  const [priority, setPriority] = useState<'normal' | 'urgent'>(announcement.priority);
  // Convert ISO to <input type="datetime-local"> compatible "YYYY-MM-DDTHH:mm".
  const initialLocal = toLocalInputValue(announcement.expiresAt);
  const [expiresLocal, setExpiresLocal] = useState(initialLocal);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      // Reset to the latest values when the dialog opens.
      setText(announcement.text);
      setPriority(announcement.priority);
      setExpiresLocal(toLocalInputValue(announcement.expiresAt));
    }
    setOpen(next);
  };

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('Announcement text is required.');
      return;
    }
    const expiresAt = new Date(expiresLocal).toISOString();
    const updated = await updateAnnouncement(announcement.id, {
      text: trimmed,
      priority,
      expiresAt,
    });
    if (!updated) {
      toast.error('Could not update announcement.');
      return;
    }
    toast.success('Announcement updated');
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Edit announcement"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Announcement</DialogTitle>
          <DialogDescription>Update the text, priority, or expiration time.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ann-text">Text</Label>
            <Textarea
              id="ann-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ann-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'normal' | 'urgent')}>
                <SelectTrigger id="ann-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ann-expires">Expires</Label>
              <Input
                id="ann-expires"
                type="datetime-local"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Convert an ISO timestamp string to the "YYYY-MM-DDTHH:mm" format
 *  that <input type="datetime-local"> wants, in local time. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
