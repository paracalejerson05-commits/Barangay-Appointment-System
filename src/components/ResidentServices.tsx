import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { dbCreateServiceRequest, dbAddNotification } from '../lib/supabaseDb';
import { useSchedule } from '../hooks/useSchedule';
import { checkProfileCompletion, getAccountStatus } from '../lib/profileUtils';
import { ProfileIncompleteModal } from './ProfileIncompleteModal';
import { AccountStatusNoticeModal } from './AccountStatusNoticeModal';
import { 
  FileText, 
  Sparkles, 
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Home,
  HeartHandshake,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getRequestReference } from '../lib/requestPresentation';
import { getAppointmentDateKey, type AvailableAppointmentSlot } from '../lib/appointmentAvailability';

interface ResidentServicesProps {
  user: any;
  profile: any;
}

export function ResidentServices({ user, profile }: ResidentServicesProps) {
  const navigate = useNavigate();
  const profileStatus = checkProfileCompletion(profile, user?.email);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState('');
  const [formData, setFormData] = useState({
    fullName: profile?.displayName || user.displayName || '',
    age: profile?.age || '',
    gender: profile?.gender || 'Male',
    civilStatus: profile?.civilStatus || 'Single',
    purpose: '',
    appointmentDate: '',
    appointmentTime: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedRequest, setSubmittedRequest] = useState<any>(null);
  const { schedule, getRecommendation, isDateAvailable, getAvailableSlots } = useSchedule();
  const [recommendation, setRecommendation] = useState<{ date: string, time: string, display: string, queueLevel?: string, estimatedWait?: string, reason?: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  React.useEffect(() => {
    const updateRecommendation = async () => {
      if (formData.appointmentDate) {
        setIsCalculating(true);
        const rec = await getRecommendation(formData.appointmentDate, serviceType);
        const slots = await getAvailableSlots(formData.appointmentDate);
        setRecommendation(rec);
        setAvailableSlots(slots);
        setIsCalculating(false);
      }
    };
    updateRecommendation();
  }, [formData.appointmentDate, serviceType, schedule]);

  const services = [
    { name: 'Barangay Clearance', description: 'For employment, ID application, and official requirements.', icon: FileText },
    { name: 'Certificate of Indigency', description: 'For medical, financial, and scholarship assistance.', icon: HeartHandshake },
    { name: 'Certificate of Residency', description: 'Proof of current living address in the barangay.', icon: Home },
    { name: 'Blotter / Incident Report', description: 'File an official incident report or dispute record.', icon: AlertTriangle },
    { name: 'BADAC Clearance', description: 'Certification for legal and official purposes related to drug-free status.', icon: ShieldCheck }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const residentUid = user?.uid || user?.id;
    if (!residentUid) {
      alert('Your session has expired. Please sign in again.');
      return;
    }

    const accountStatus = getAccountStatus(profile, user?.email);
    if (accountStatus !== 'approved') {
      setShowIncompleteModal(false);
      setShowStatusNoticeModal(true);
      return;
    }

    // Enforce profile completion check
    const profileCheck = checkProfileCompletion(profile, user?.email);
    if (!profileCheck.isComplete) {
      setShowIncompleteModal(true);
      return;
    }

    // Validation
    if (!formData.appointmentDate) {
      alert("Please select an appointment date.");
      return;
    }

    if (!schedule?.weekly) {
      alert("No appointment schedule has been configured by the administrator yet.");
      return;
    }

    if (!formData.appointmentTime) {
      alert("Please select a preferred time slot.");
      return;
    }

    if (!isDateAvailable(formData.appointmentDate)) {
      alert("Selected date is not available. Please choose another date.");
      return;
    }

    const refreshedSlots = await getAvailableSlots(formData.appointmentDate);
    setAvailableSlots(refreshedSlots);
    const selectedSlot = refreshedSlots.find((slot: AvailableAppointmentSlot) => slot.time === formData.appointmentTime && !slot.isFull);
    if ((import.meta as any).env?.DEV) {
      const now = new Date();
      const current = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        dateStyle: 'short',
        timeStyle: 'medium'
      }).format(now);
      const selectedDateTime = `${formData.appointmentDate}T${formData.appointmentTime}:00 Asia/Manila`;
      const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'long'
      }).format(new Date(`${formData.appointmentDate}T00:00:00Z`));
      const daySchedule = schedule.weekly?.[dayName];
      const specialDate = schedule.specialDates?.find((item: any) => item.date === formData.appointmentDate);
      const configuredSchedule = specialDate && !specialDate.closed ? specialDate : daySchedule;
      console.debug('[Appointment Validation]', {
        currentDate: current.split(',')[0],
        currentTime: current.split(', ')[1],
        currentDatetime: current,
        selectedAppointmentDate: formData.appointmentDate,
        selectedAppointmentTime: formData.appointmentTime,
        combinedAppointmentDatetime: selectedDateTime,
        adminOpeningTime: configuredSchedule?.start || null,
        adminClosingTime: configuredSchedule?.end || null,
        adminOpenClosed: Boolean(configuredSchedule && !specialDate?.closed && configuredSchedule.enabled !== false),
        occupiedSlots: refreshedSlots.filter((slot: AvailableAppointmentSlot) => slot.isFull).map((slot: AvailableAppointmentSlot) => slot.time),
        selectedSlot: selectedSlot || null,
        availabilityResult: Boolean(selectedSlot),
        validationResult: Boolean(selectedSlot)
      });
    }
    if (!selectedSlot) {
      const nextSlot = await getRecommendation(formData.appointmentDate, serviceType);
      if (nextSlot) {
        setFormData(current => ({ ...current, appointmentDate: nextSlot.date, appointmentTime: nextSlot.time }));
        setRecommendation(nextSlot);
        alert(`That time is no longer available. The next available slot is ${nextSlot.display}. Please press Submit Request again to confirm it.`);
      } else {
        alert("There are no available administrator-defined appointment slots. Please choose another date.");
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const createdRequest = await dbCreateServiceRequest({
        residentUid,
        residentName: formData.fullName,
        residentEmail: user.email,
        serviceType,
        description: formData.purpose,
        appointmentDate: formData.appointmentDate,
        appointmentTime: formData.appointmentTime,
        status: 'pending'
      });

      // Create notification for admin
      await dbAddNotification({
        userId: 'admin',
        title: 'New Service Request',
        message: `${formData.fullName} submitted a request for ${serviceType}.`,
        type: 'info'
      });

      setSubmittedRequest(createdRequest);
      setSuccess(true);
      setFormData({ ...formData, purpose: '' });
      setStep(1);
      setServiceType('');
      setTimeout(() => setSuccess(false), 5000);

      // Refresh available slots and recommendation after booking
      if (formData.appointmentDate) {
        const slots = await getAvailableSlots(formData.appointmentDate);
        setAvailableSlots(slots);
        const rec = await getRecommendation(formData.appointmentDate, serviceType);
        setRecommendation(rec);
      }
    } catch (error) {
      console.error("Error submitting request:", error);
      alert(error instanceof Error ? error.message : "Failed to submit request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountStatus = getAccountStatus(profile, user?.email);
  const [showStatusNoticeModal, setShowStatusNoticeModal] = useState(false);

  const handleContinueToDetails = () => {
    if (accountStatus !== 'approved') {
      setShowStatusNoticeModal(true);
      return;
    }
    if (!profileStatus.isComplete) {
      setShowIncompleteModal(true);
      return;
    }
    setStep(2);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3 sm:space-y-4">
      {/* Compact Page Header without large logo */}
      <div className="text-center pt-1 pb-1">
        <h2 className="text-[23px] sm:text-3xl font-bold text-[#0F172A] tracking-tight">
          Services
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-medium">
          Select the document or service you need and provide your details.
        </p>
      </div>

      {/* Warning banner when profile is incomplete */}
      {!profileStatus.isComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900">
                Complete your profile to request services
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-700 font-normal">
                You can browse services, but you must complete your profile before submitting a request.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="w-full sm:w-auto h-10 sm:h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-[8px] font-semibold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-[12px] flex items-center gap-3 text-emerald-800 shadow-sm text-xs sm:text-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-semibold">Request submitted successfully.</p>
              <p className="text-xs font-normal mt-0.5">Reference: <span className="font-mono font-semibold">{submittedRequest?.referenceNumber || getRequestReference(submittedRequest?.id, submittedRequest?.createdAt)}</span>. Track it in “My Requests”.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Step Indicator */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={cn(
            "h-10 px-4 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
            step === 1 
              ? "bg-[#2563EB] text-white shadow-sm" 
              : "bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]"
          )}
        >
          <span className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold",
            step === 1 ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
          )}>
            1
          </span>
          <span>Select Service</span>
        </button>

        <ArrowRight className="w-4 h-4 text-[#94A3B8]" />

        <div
          className={cn(
            "h-10 px-4 rounded-[10px] text-xs font-semibold flex items-center gap-2 transition-all",
            step === 2 
              ? "bg-[#2563EB] text-white shadow-sm" 
              : "bg-white border border-[#E2E8F0] text-[#64748B]"
          )}
        >
          <span className={cn(
            "w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold",
            step === 2 ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
          )}>
            2
          </span>
          <span>Fill Details</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="bg-white p-3.5 sm:p-6 rounded-[14px] border border-[#E2E8F0] shadow-sm"
            >
              {/* Header inside Available Services */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Available Services</h3>
                  <p className="text-xs text-[#64748B]">Select a service to continue</p>
                </div>
                {serviceType && (
                  <span className="text-xs font-semibold text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-[6px] border border-blue-100">
                    Selected: {serviceType}
                  </span>
                )}
              </div>

              {/* Compact 3-column Service Cards Grid on Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                {services.map((service) => {
                  const isSelected = serviceType === service.name;
                  return (
                    <button
                      key={service.name}
                      type="button"
                      onClick={() => setServiceType(service.name)}
                      className={cn(
                        "p-3 sm:p-4 rounded-[12px] text-left border transition-all flex flex-row sm:flex-col items-center sm:items-stretch justify-start sm:justify-between gap-3 sm:gap-0 min-h-[88px] sm:h-[130px] cursor-pointer group",
                        isSelected 
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#0F172A] shadow-xs ring-1 ring-[#2563EB]" 
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-blue-300 hover:bg-[#F8FAFC] shadow-2xs"
                      )}
                    >
                      <div className="flex items-center justify-between flex-shrink-0 sm:w-full">
                        <div className={cn(
                          "w-8 h-8 sm:w-9 sm:h-9 rounded-[8px] flex items-center justify-center transition-colors",
                          isSelected 
                            ? "bg-[#2563EB] text-white" 
                            : "bg-[#F1F5F9] text-[#2563EB] group-hover:bg-blue-50"
                        )}>
                          <service.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 sm:flex-none">
                        <h4 className={cn(
                          "font-bold text-[13px] sm:text-sm leading-snug line-clamp-2 sm:line-clamp-1 mb-0.5 sm:mb-1 transition-colors",
                          isSelected ? "text-[#2563EB]" : "text-[#0F172A] group-hover:text-[#2563EB]"
                        )}>
                          {service.name}
                        </h4>
                        <p className="text-[11px] text-[#64748B] leading-snug line-clamp-1 sm:line-clamp-2">
                          {service.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Continue Button */}
              <div className="flex items-center justify-end mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={handleContinueToDetails}
                  disabled={!serviceType}
                  className="h-10 px-5 sm:px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold rounded-[10px] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <form onSubmit={handleSubmit} className="bg-white p-3.5 sm:p-6 rounded-[14px] border border-[#E2E8F0] shadow-sm space-y-3.5 sm:space-y-5">
                {/* Form Header */}
                <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-[#2563EB] rounded-[8px] flex items-center justify-center border border-blue-100">
                      {services.find(s => s.name === serviceType)?.icon && React.createElement(services.find(s => s.name === serviceType)!.icon, { className: "w-5 h-5" })}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0F172A]">{serviceType}</h3>
                      <p className="text-xs text-[#64748B]">Please provide the required appointment information.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-[8px] hover:bg-blue-50 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Change Service
                  </button>
                </div>

                {/* Profile Incomplete Warning inside Step 2 */}
                {!profileStatus.isComplete && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-[10px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-800">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Profile Incomplete</p>
                        <p className="text-[11px] text-amber-700">Complete your profile before submitting.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/settings')}
                      className="w-full sm:w-auto h-9 px-3.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-[8px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                    >
                      <span>Complete Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Row 1: Full Name & Age */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Full Name</label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Age</label>
                      <input
                        type="number"
                        required
                        value={formData.age}
                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Row 2: Gender & Civil Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Civil Status</label>
                      <select
                        value={formData.civilStatus}
                        onChange={(e) => setFormData({ ...formData, civilStatus: e.target.value })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      >
                        <option>Single</option>
                        <option>Married</option>
                        <option>Widowed</option>
                        <option>Separated</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Appointment Date & Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Appointment Date</label>
                      <input
                        type="date"
                        required
                        min={getAppointmentDateKey()}
                        value={formData.appointmentDate}
                        onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value, appointmentTime: '' })}
                        className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors"
                      />
                      {!isDateAvailable(formData.appointmentDate) && formData.appointmentDate && (
                        <p className="text-[10px] text-red-600 font-medium mt-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Barangay Hall is closed on this day.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Preferred Time Slot</label>
                      <div className="relative">
                        <select
                          required
                          disabled={availableSlots.length === 0}
                          value={formData.appointmentTime}
                          onChange={(e) => setFormData({ ...formData, appointmentTime: e.target.value })}
                          className="w-full bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 py-2 pr-9 text-xs text-[#0F172A] focus:border-[#2563EB] focus:outline-none transition-colors appearance-none disabled:opacity-50"
                        >
                          <option value="">{availableSlots.length === 0 ? 'Select date first' : 'Select a time slot'}</option>
                          {availableSlots.map((slot) => (
                            <option key={slot.time} value={slot.time} disabled={slot.isFull}>
                              {slot.display} {slot.isFull ? '(FULL)' : (recommendation?.time === slot.time ? '(Recommended)' : '')}
                            </option>
                          ))}
                        </select>
                        <Clock className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendation Banner */}
                  {recommendation ? (
                    <div className="bg-blue-50 p-3 rounded-[10px] border border-blue-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-[#2563EB] rounded-[6px] text-white">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wide">AI Recommendation</p>
                          <p className="text-xs text-[#1E293B] font-medium">{recommendation.display} • {recommendation.estimatedWait || 'Estimated wait unavailable'} • {recommendation.queueLevel || 'Available queue'}</p>
                          <p className="text-[10px] text-[#64748B] mt-0.5">{recommendation.reason || 'Selected from administrator-defined availability.'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, appointmentDate: recommendation.date, appointmentTime: recommendation.time })}
                        className="bg-white border border-blue-200 text-[#2563EB] hover:bg-blue-50 px-3 py-1 rounded-[6px] text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                      >
                        Use Slot
                      </button>
                    </div>
                  ) : formData.appointmentDate && !isCalculating && availableSlots.length === 0 ? (
                    <div className="bg-amber-50 p-3 rounded-[10px] border border-amber-200 text-xs text-amber-800">
                      No available administrator-defined slots were found for this date. Please choose another available date.
                    </div>
                  ) : isCalculating ? (
                    <div className="text-xs text-[#64748B] flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563EB]" /> Calculating the best available slot...
                    </div>
                  ) : null}

                  {/* Purpose */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Purpose of Request</label>
                    <textarea
                      required
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      placeholder="e.g., For scholarship application, local employment requirement, or business permit..."
                      className="w-full bg-white border border-[#E2E8F0] rounded-[10px] p-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition-colors h-24 resize-none"
                    />
                  </div>

                  {/* AI Smart Tip */}
                  <div className="bg-[#F8FAFC] p-3 rounded-[10px] flex items-start gap-2.5 border border-[#E2E8F0]">
                    <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      <strong className="text-[#0F172A]">AI Smart Tip:</strong> {serviceType} requests submitted with complete details before 10:00 AM are usually processed within the same business day.
                    </p>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="h-10 px-4 border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] text-xs font-semibold rounded-[10px] transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-10 px-6 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs rounded-[10px] transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Service Request</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Incomplete Modal */}
      <ProfileIncompleteModal
        isOpen={showIncompleteModal}
        onClose={() => setShowIncompleteModal(false)}
        missingFields={profileStatus.missingFields}
        title="Profile Required"
        message="You must complete your resident profile before submitting a service request."
        onCompleteProfile={() => {
          setShowIncompleteModal(false);
          navigate('/settings');
        }}
      />

      {/* Account Status Notice Modal */}
      <AccountStatusNoticeModal
        isOpen={showStatusNoticeModal}
        onClose={() => setShowStatusNoticeModal(false)}
        status={accountStatus}
        onGoToSettings={() => navigate('/settings')}
      />
    </div>
  );
}
