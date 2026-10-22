import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ArrowRight, X, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileIncompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: string[];
  title?: string;
  message?: string;
  onCompleteProfile?: () => void;
}

export function ProfileIncompleteModal({
  isOpen,
  onClose,
  missingFields,
  title = "Complete Your Profile",
  message = "Please complete your required resident information before submitting a service request.",
  onCompleteProfile
}: ProfileIncompleteModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleNavigate = () => {
    onClose();
    if (onCompleteProfile) {
      onCompleteProfile();
    } else {
      navigate('/settings');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[14px] shadow-xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#F1F5F9] dark:border-slate-800 flex items-start justify-between gap-3 bg-[#F8FAFC] dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800 flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] dark:text-white text-base">
                  {title}
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  Profile Incomplete
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-[8px] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {message}
            </p>

            {missingFields && missingFields.length > 0 && (
              <div className="bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-[10px] p-3 space-y-2">
                <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Missing Information ({missingFields.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 shadow-2xs"
                    >
                      • {field}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions - Mobile-First responsive */}
          <div className="p-4 sm:p-5 pt-0 sm:pt-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto h-11 sm:h-10 px-4 text-xs font-semibold text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-slate-800 rounded-[8px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNavigate}
              className="w-full sm:w-auto h-11 sm:h-10 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Complete Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
