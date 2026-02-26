'use client';

import { Restaurant } from '@mui/icons-material';
import { Guest } from '@/store/guestStore';
import ListManagementDialog from '@/components/shared/molecules/ListManagementDialog';

interface MealPlanModalProps {
  open: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSave: (guestId: string, mealPlans: string[]) => void;
}

export default function MealPlanModal({
  open,
  onClose,
  guest,
  onSave,
}: MealPlanModalProps) {
  if (!guest) return null;

  return (
    <ListManagementDialog
      open={open}
      onClose={onClose}
      onSave={(items) => onSave(guest.id, items)}
      title="Meal Plans"
      subtitle={guest.name}
      icon={<Restaurant color="primary" />}
      initialItems={guest.mealPlans || []}
      addLabel="Add New Meal Plan"
      addPlaceholder="Enter meal plan (e.g., Vegetarian, Halal, etc.)"
      itemsLabel="Current Meal Plans"
      emptyMessage="No meal plans assigned. Add meal plans above."
    />
  );
}
