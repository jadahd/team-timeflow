import { useState } from 'react';
import { MOCK_ANNOUNCEMENTS } from '@/data/mockData';
import { Announcement } from '@/types/workforce';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Megaphone } from 'lucide-react';

export const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [newText, setNewText] = useState('');

  const addAnnouncement = () => {
    if (!newText.trim()) return;
    const ann: Announcement = {
      id: `ann-${Date.now()}`,
      text: newText.trim(),
      priority: 'normal',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      createdBy: '3',
    };
    setAnnouncements(prev => [ann, ...prev]);
    setNewText('');
  };

  const removeAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Announcements</h1>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Type a new announcement..."
              onKeyDown={e => e.key === 'Enter' && addAnnouncement()}
              className="flex-1"
            />
            <Button onClick={addAnnouncement} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Announcements auto-expire after 48 hours. Displayed on kiosk.</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {announcements.map(ann => (
          <Card key={ann.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <Megaphone className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ann.priority === 'urgent' ? 'text-destructive' : 'text-accent'}`} />
              <div className="flex-1">
                <p className="text-sm text-foreground">{ann.text}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={ann.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-xs">
                    {ann.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Expires {new Date(ann.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button onClick={() => removeAnnouncement(ann.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
