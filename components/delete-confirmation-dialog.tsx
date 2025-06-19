// @ts-nocheck
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ success: boolean; message: string }>;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone. This will permanently delete all bank statements and associated files.',
  confirmText = 'Delete All',
  cancelText = 'Cancel',
  variant = 'destructive',
}: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      console.log('Starting deletion confirmation...');
      const result = await onConfirm();
      
      if (result?.success) {
        console.log('Deletion successful:', result.message);
        toast({
          title: 'Success',
          description: result.message || 'Bank statements deleted successfully',
          variant: 'default',
        });
      } else {
        console.error('Deletion failed:', result?.message || 'Unknown error');
        throw new Error(result?.message || 'Failed to delete bank statements');
      }
    } catch (error) {
      console.error('Error in handleConfirm:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        response: error?.response?.data || 'No response data'
      });
      
      let errorMessage = 'An error occurred while deleting bank statements';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: 10000, // Show for 10 seconds
      });
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className={`${variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
