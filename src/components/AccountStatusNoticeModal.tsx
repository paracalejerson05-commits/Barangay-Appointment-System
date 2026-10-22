import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, XCircle, ArrowRight, X, Phone, Building2 } from 'lucide-react';
import { AccountStatus } from '../lib/profileUtils';
import { AccountStatusBadge } from './AccountStatusBadge';

interface AccountStatusNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: AccountStatus | string;
  onGoToSettings?: () => void;
}

export function AccountStatusNoticeModal({
  isOpen,
  onClose,
  status,
  onGoToSettings
}: AccountStatusNoticeModalProps) {
  if (!isOpen) return null;

  const isRejected = status === 'rejected';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.16 }}
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[14px] shadow-xl overflow-hidden border border-[#E2E8F0] dark:border-slate-800 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#F1F5F9] dark:border-slate-800 flex items-start justify-between gap-3 bg-[#F8FAFC] dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center border flex-shrink-0 ${
                isRejected 
                  ? 'bg-red-50 dark:bg-red-950/60 text-red-600 border-red-200 dark:border-red-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 border-amber-200 dark:border-amber-800'
              }`}>
                {isRejected ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-[#0F172A] dark:text-white text-base">
                  {isRejected ? 'Account Registration Rejected' : 'Account Pending Approval'}
                </h3>
                <div className="mt-0.5">
                  <AccountStatusBadge status={status} size="sm" />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-[8px] text-[#64748B] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {isRejected ? (
                'Your resident registration was not approved by the Barangay Administrator. You are restricted from requesting barangay clearances, permits, or certificates.'
              ) : (
                'Your resident account is currently waiting for administrator review and approval. While waiting, you can explore services and update your profile, but cannot submit new requests.'
              )}
            </p>

            <div className="p-3.5 bg-[#F8FAFC] dark:bg-slate-800/60 rounded-[10px] border border-[#E2E8F0] dark:border-slate-800 space-y-2 text-xs text-[#475569] dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-[#0F172A] dark:text-white">
                <Building2 className="w-4 h-4 text-[#2563EB]" />
                <span>Barangay Administration Hall</span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                Approvals are processed during regular office hours: Monday to Friday, 8:00 AM to 5:00 PM.
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 pt-0 sm:pt-0 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto h-11 sm:h-10 px-4 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-[8px] transition-colors cursor-pointer"
            >
              Understood
            </button>
            {onGoToSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToSettings();
                }}
                className="w-full sm:w-auto h-11 sm:h-10 px-5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[8px] transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>View Profile Settings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
