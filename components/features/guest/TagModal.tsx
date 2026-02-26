'use client';

import { LocalOffer } from '@mui/icons-material';
import { Guest } from '@/store/guestStore';
import { toUpperCamelCase } from '@/utils/tagUtils';
import ListManagementDialog from '@/components/shared/molecules/ListManagementDialog';

interface TagModalProps {
  open: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSave: (guestId: string, tags: string[]) => void;
}

export default function TagModal({
  open,
  onClose,
  guest,
  onSave,
}: TagModalProps) {
  if (!guest) return null;

  return (
    <ListManagementDialog
      open={open}
      onClose={onClose}
      onSave={(items) => onSave(guest.id, items)}
      title="Tags"
      subtitle={guest.name}
      icon={<LocalOffer color="primary" />}
      initialItems={guest.tags || []}
      addLabel="Add New Tag"
      addPlaceholder="Enter tag (e.g., Cybersecurity, Bahasa, etc.)"
      itemsLabel="Current Tags"
      emptyMessage="No tags assigned. Add tags above."
      addCaption={'Tags are stored in UpperCamelCase (e.g., \u201cmachine learning\u201d becomes \u201cMachineLearning\u201d)'}
      normalize={toUpperCamelCase}
      preventDuplicates
    />
  );
}
