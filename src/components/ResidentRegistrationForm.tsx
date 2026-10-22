import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  FileImage,
  Key,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  UserPlus,
  UserRound
} from 'lucide-react';
import {
  getPasswordRequirementError,
  getResidentAge,
  isPhilippineMobileNumber,
  validateResidentImage
} from '../lib/residentRegistrationValidation';

export interface ResidentRegistrationSubmission {
  email: string;
  password: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  civilStatus: string;
  mobileNumber: string;
  houseStreet: string;
  purokSitio: string;
  barangay: string;
  municipalityCity: string;
  province: string;
  idType: string;
  idTypeOther: string;
  idFrontFile: File | null;
  idBackFile: File | null;
  faceFile: File | null;
  faceRegistrationMethod: 'camera' | 'upload' | 'in_person';
}

interface ResidentRegistrationFormProps {
  existingUser?: any;
  existingProfile?: any;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  onSubmit: (submission: ResidentRegistrationSubmission) => void;
  onGoogleSignIn: () => void;
  onSignIn: () => void;
}

const STEPS = ['Account Details', 'Personal Information', 'Identity Verification', 'Review and Submit'];
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const ID_TYPES = ['PhilSys National ID', "Driver's License", 'Passport', "Voter's ID", 'Other Accepted ID'];
const ERROR_FIELD_IDS: Record<string, string> = {
  email: 'registration-email',
  password: 'registration-password',
  confirmPassword: 'registration-confirm-password',
  fullName: 'registration-full-name',
  dateOfBirth: 'registration-dob',
  gender: 'registration-gender',
  civilStatus: 'registration-civil-status',
  mobileNumber: 'registration-mobile',
  purokSitio: 'registration-purok',
  municipalityCity: 'registration-municipality',
  province: 'registration-province',
  idType: 'registration-id-type',
  idTypeOther: 'registration-id-other',
  privacyConsent: 'registration-privacy-consent'
};

function useFilePreview(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url;
}

function ImageUpload({
  label,
  file,
  onChange,
  required = false,
  currentFileExists = false,
  disabled = false
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  currentFileExists?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useFilePreview(file);
  const [fileError, setFileError] = useState('');

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      await validateResidentImage(selected);
      setFileError('');
      onChange(selected);
    } catch (validationError) {
      setFileError(validationError instanceof Error ? validationError.message : 'Unable to use this image.');
      event.target.value = '';
    }
  };

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <label className="text-sm font-bold text-slate-800">
          {label}{required && <span className="text-red-600"> *</span>}
        </label>
        <span className="text-[11px] text-slate-500">JPG, PNG, WebP · max 5 MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={disabled}
        onChange={chooseFile}
        className="sr-only"
        aria-label={`Choose ${label.toLowerCase()}`}
      />
      {previewUrl ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <img src={previewUrl} alt={`${label} preview`} className="h-28 w-full rounded-lg border border-slate-200 object-contain bg-slate-50 sm:w-40" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Replace
            </button>
            <button type="button" onClick={() => { onChange(null); setFileError(''); if (inputRef.current) inputRef.current.value = ''; }} disabled={disabled} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-between gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <FileImage className="h-5 w-5 shrink-0 text-blue-600" />
            <span>{currentFileExists ? 'A document is already on file.' : 'Add a clear, readable image.'}</span>
          </div>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled} className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" /> {currentFileExists ? 'Replace' : 'Choose image'}
          </button>
        </div>
      )}
      {fileError && <p role="alert" className="mt-2 text-xs font-medium text-red-700">{fileError}</p>}
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">{label}</label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

const inputClass = 'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-200';
function localDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function ResidentRegistrationForm({
  existingUser,
  existingProfile,
  isLoading,
  error,
  successMessage,
  onSubmit,
  onGoogleSignIn,
  onSignIn
}: ResidentRegistrationFormProps) {
  const metadata = existingUser?.user_metadata || {};
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(existingUser?.email || existingProfile?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState(existingProfile?.display_name || metadata.full_name || metadata.name || '');
  const [dateOfBirth, setDateOfBirth] = useState(String(existingProfile?.date_of_birth || '').slice(0, 10));
  const [gender, setGender] = useState(existingProfile?.gender || '');
  const [civilStatus, setCivilStatus] = useState(existingProfile?.civil_status || '');
  const [mobileNumber, setMobileNumber] = useState(existingProfile?.contact_number || '');
  const [houseStreet, setHouseStreet] = useState(existingProfile?.house_street || '');
  const [purokSitio, setPurokSitio] = useState(existingProfile?.purok_sitio || '');
  const [barangay, setBarangay] = useState(existingProfile?.barangay || 'Barangay Pupua');
  const [municipalityCity, setMunicipalityCity] = useState(existingProfile?.municipality_city || '');
  const [province, setProvince] = useState(existingProfile?.province || '');
  const [idType, setIdType] = useState(existingProfile?.id_type || '');
  const [idTypeOther, setIdTypeOther] = useState(existingProfile?.id_type_other || '');
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const savedFaceMethod = existingProfile?.face_registration_method;
  const [faceMethod, setFaceMethod] = useState<'camera' | 'upload' | 'in_person'>(
    savedFaceMethod === 'upload' || savedFaceMethod === 'in_person' ? savedFaceMethod : 'camera'
  );
  const [faceConfirmed, setFaceConfirmed] = useState(Boolean(existingProfile?.face_photo_path));
  const [privacyConsent, setPrivacyConsent] = useState(Boolean(existingProfile?.privacy_consent_at));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cameraMessage, setCameraMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const idFrontPreview = useFilePreview(idFrontFile);
  const idBackPreview = useFilePreview(idBackFile);
  const facePreview = useFilePreview(faceFile);
  const age = getResidentAge(dateOfBirth);
  const passwordStrength = [
    password.length >= 8,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setCameraMessage('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported on this device or browser. Upload a face photo or choose in-person verification instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraMessage('Camera is active. Face the camera directly and make sure your face is well lit.');
    } catch (cameraFailure) {
      const cameraException = cameraFailure as DOMException;
      if (cameraException.name === 'NotAllowedError' || cameraException.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Allow camera access in your browser settings, upload a face photo, or choose in-person verification.');
      } else if (cameraException.name === 'NotFoundError' || cameraException.name === 'DevicesNotFoundError') {
        setCameraError('No camera was found. Upload a face photo or choose in-person verification.');
      } else {
        setCameraError('The camera could not be started. Check that it is not being used by another app, then try again or use an alternative.');
      }
    }
  };

  const captureFace = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('The camera is not ready yet. Wait for the preview, then capture again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Unable to capture a photo on this device. Upload a face photo or choose in-person verification.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('The photo could not be captured. Please try again.');
        return;
      }
      const capturedPhoto = new File([blob], `resident-face-${Date.now()}.jpg`, { type: 'image/jpeg' });
      void validateResidentImage(capturedPhoto).then(() => {
        setFaceFile(capturedPhoto);
        setFaceMethod('camera');
        setFaceConfirmed(false);
        setCameraError('');
        setCameraMessage('Review the captured image, then confirm it or retake the photo.');
      }).catch((validationError) => {
        setCameraError(validationError instanceof Error ? validationError.message : 'The captured photo could not be used.');
      });
      stopCamera();
    }, 'image/jpeg', 0.9);
  };

  const chooseFaceFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      await validateResidentImage(selected);
      setFaceFile(selected);
      setFaceMethod('upload');
      setFaceConfirmed(true);
      setCameraError('');
    } catch (validationError) {
      setCameraError(validationError instanceof Error ? validationError.message : 'Unable to use this image.');
      event.target.value = '';
    }
  };

  const validateStep = () => {
    const nextErrors: Record<string, string> = {};
    if (step === 0 && !existingUser) {
      const normalizedEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        nextErrors.email = 'Enter a valid email address.';
      }
      const passwordError = getPasswordRequirementError(password);
      if (passwordError) nextErrors.password = passwordError;
      if (password !== confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (step === 1) {
      if (fullName.trim().length < 2) nextErrors.fullName = 'Enter your full name.';
      if (!dateOfBirth || age === null || age < 0) nextErrors.dateOfBirth = 'Enter a valid date of birth that is not in the future.';
      if (!gender) nextErrors.gender = 'Select your gender.';
      if (!civilStatus) nextErrors.civilStatus = 'Select your civil status.';
      if (!isPhilippineMobileNumber(mobileNumber)) nextErrors.mobileNumber = 'Enter an 11-digit Philippine mobile number beginning with 09.';
      if (!purokSitio.trim()) nextErrors.purokSitio = 'Enter your Purok or Sitio.';
      if (!municipalityCity.trim()) nextErrors.municipalityCity = 'Enter your municipality or city.';
      if (!province.trim()) nextErrors.province = 'Enter your province.';
    }
    if (step === 2) {
      if (!privacyConsent) nextErrors.privacyConsent = 'Please acknowledge the privacy notice before uploading verification images.';
      if (!idType) nextErrors.idType = 'Select the type of valid ID.';
      if (idType === 'Other Accepted ID' && !idTypeOther.trim()) nextErrors.idTypeOther = 'Describe the accepted ID.';
      if (!idFrontFile && !existingProfile?.id_front_path) nextErrors.idFront = 'Upload the front of your valid ID.';
      if (faceMethod !== 'in_person' && !faceFile && !existingProfile?.face_photo_path) {
        nextErrors.facePhoto = 'Capture or upload a face photo, or choose in-person verification.';
      }
      if (faceFile && !faceConfirmed) nextErrors.facePhoto = 'Confirm the captured photo or retake it.';
    }
    setErrors(nextErrors);
    const firstInvalidField = Object.keys(nextErrors)[0];
    if (firstInvalidField) {
      window.requestAnimationFrame(() => {
        const errorField = ERROR_FIELD_IDS[firstInvalidField]
          ? document.getElementById(ERROR_FIELD_IDS[firstInvalidField])
          : document.querySelector<HTMLElement>('[data-registration-first-upload]');
        errorField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        errorField?.focus({ preventScroll: true });
      });
    }
    return Object.keys(nextErrors).length === 0;
  };

  const continueStep = () => {
    if (!validateStep()) return;
    setErrors({});
    setStep(current => Math.min(current + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitRegistration = (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    if (step < STEPS.length - 1) {
      continueStep();
      return;
    }
    if (!validateStep()) return;
    onSubmit({
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      dateOfBirth,
      age: age ?? 0,
      gender,
      civilStatus,
      mobileNumber,
      houseStreet: houseStreet.trim(),
      purokSitio: purokSitio.trim(),
      barangay: 'Barangay Pupua',
      municipalityCity: municipalityCity.trim(),
      province: province.trim(),
      idType,
      idTypeOther: idType === 'Other Accepted ID' ? idTypeOther.trim() : '',
      idFrontFile,
      idBackFile,
      faceFile,
      faceRegistrationMethod: faceMethod
    });
  };

  const clearFacePhoto = () => {
    setFaceFile(null);
    setFaceConfirmed(false);
    setCameraMessage('');
    setErrors(current => ({ ...current, facePhoto: '' }));
  };

  return (
    <form onSubmit={submitRegistration} className="auth-signup-form space-y-4">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-1" aria-label={`Registration step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, index) => (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < step ? 'bg-emerald-600 text-white' : index === step ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {index < step ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className={`text-center text-[9px] leading-tight sm:text-[10px] ${index === step ? 'font-bold text-blue-700' : 'text-slate-500'}`}>{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {(error || successMessage) && (
        <div role={error ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{error || successMessage}</span>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-bold">Please fix these items to continue:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {Object.values(errors).map(message => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      {step === 0 && (
        <section aria-labelledby="registration-account-heading" className="space-y-4">
          <div>
            <h2 id="registration-account-heading" className="text-base font-bold text-slate-900">Account Details</h2>
            <p className="text-xs text-slate-500">Create a secure resident account. Approval is completed by an administrator.</p>
          </div>
          {existingUser ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <p className="text-sm font-bold text-blue-900">Account signed in</p>
                  <p className="mt-1 break-all text-sm text-blue-800">{existingUser.email}</p>
                  <p className="mt-1 text-xs text-blue-700">Continue to finish resident registration. No Google password is requested here.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Field label="Email Address" id="registration-email" error={errors.email}>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input id="registration-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} className={`${inputClass} pl-10`} aria-describedby={errors.email ? 'registration-email-error' : undefined} />
                </div>
              </Field>
              <Field label="Password" id="registration-password" error={errors.password}>
                <div className="relative">
                  <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input id="registration-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} className={`${inputClass} pl-10 pr-12`} />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded text-slate-500">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex gap-1" aria-label={`Password strength ${passwordStrength} of 4`}>
                    {[0, 1, 2, 3].map(index => <span key={index} className={`h-1.5 flex-1 rounded-full ${passwordStrength > index ? passwordStrength >= 3 ? 'bg-emerald-500' : 'bg-amber-500' : 'bg-slate-200'}`} />)}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">At least 8 characters, uppercase and lowercase letters, and a number.</p>
                </div>
              </Field>
              <Field label="Confirm Password" id="registration-confirm-password" error={errors.confirmPassword}>
                <input id="registration-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className={inputClass} />
              </Field>
              <div className="flex items-center gap-3 py-1" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" /><span className="text-[11px] font-bold text-slate-400">OR</span><span className="h-px flex-1 bg-slate-200" />
              </div>
              <button type="button" disabled={isLoading} onClick={onGoogleSignIn} className="auth-google-button flex min-h-[50px] w-full items-center justify-center gap-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50">
                <span className="text-lg font-bold text-blue-600">G</span> Continue with Google
              </button>
              <p className="text-center text-xs text-slate-600">Already registered? <button type="button" onClick={onSignIn} className="min-h-[40px] font-bold text-blue-700 hover:underline">Sign in</button></p>
            </>
          )}
        </section>
      )}

      {step === 1 && (
        <section aria-labelledby="registration-personal-heading" className="space-y-4">
          <div>
            <h2 id="registration-personal-heading" className="text-base font-bold text-slate-900">Personal Information</h2>
            <p className="text-xs text-slate-500">Enter your information as it appears on your valid ID.</p>
          </div>
          <Field label="Full Name" id="registration-full-name" error={errors.fullName}>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="registration-full-name" required autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Juan Dela Cruz" className={`${inputClass} pl-10`} />
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date of Birth" id="registration-dob" error={errors.dateOfBirth}>
              <input id="registration-dob" type="date" required max={localDateString()} value={dateOfBirth} onChange={event => setDateOfBirth(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Age (calculated)" id="registration-age">
              <input id="registration-age" readOnly value={age === null ? '' : `${age} years old`} placeholder="Calculated from date of birth" className={`${inputClass} bg-slate-100 text-slate-600`} />
            </Field>
            <Field label="Gender" id="registration-gender" error={errors.gender}>
              <select id="registration-gender" required value={gender} onChange={event => setGender(event.target.value)} className={inputClass}>
                <option value="">Select gender</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Another identity</option><option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Civil Status" id="registration-civil-status" error={errors.civilStatus}>
              <select id="registration-civil-status" required value={civilStatus} onChange={event => setCivilStatus(event.target.value)} className={inputClass}>
                <option value="">Select civil status</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option><option>Annulled</option>
              </select>
            </Field>
            <Field label="Mobile Number" id="registration-mobile" error={errors.mobileNumber}>
              <input id="registration-mobile" type="tel" inputMode="numeric" autoComplete="tel-national" required pattern="09[0-9]{9}" maxLength={11} value={mobileNumber} onChange={event => setMobileNumber(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="09XXXXXXXXX" className={inputClass} />
            </Field>
            <Field label="House/Lot Number and Street (if applicable)" id="registration-house-street">
              <input id="registration-house-street" autoComplete="street-address" value={houseStreet} onChange={event => setHouseStreet(event.target.value)} placeholder="House or street" className={inputClass} />
            </Field>
          </div>
          <Field label="Purok or Sitio" id="registration-purok" error={errors.purokSitio}>
            <input id="registration-purok" required value={purokSitio} onChange={event => setPurokSitio(event.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Barangay" id="registration-barangay">
              <input id="registration-barangay" readOnly value="Barangay Pupua" className={`${inputClass} bg-slate-100 text-slate-600`} />
            </Field>
            <Field label="Municipality/City" id="registration-municipality" error={errors.municipalityCity}>
              <input id="registration-municipality" required value={municipalityCity} onChange={event => setMunicipalityCity(event.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Province" id="registration-province" error={errors.province}>
            <input id="registration-province" required value={province} onChange={event => setProvince(event.target.value)} className={inputClass} />
          </Field>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="registration-identity-heading" className="space-y-4">
          <div>
            <h2 id="registration-identity-heading" className="text-base font-bold text-slate-900">Identity Verification</h2>
            <p className="text-xs text-slate-500">Readable, unexpired ID images help administrators review your residency. PDF files are not accepted.</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-950">
            <h3 className="mb-1 flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4" /> Privacy Notice</h3>
            <p>We collect your ID and face-registration photo only to support resident identity and account verification. Only authorized barangay administrators can access these private files, and they will use them for manual review. Files are stored in access-controlled private storage and retained under the barangay’s records-retention policy. The face photo is not used for facial recognition, biometric templates, or automated identity matching.</p>
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 border-t border-blue-200 pt-2.5 font-semibold">
              <input
                id="registration-privacy-consent"
                type="checkbox"
                checked={privacyConsent}
                onChange={event => {
                  setPrivacyConsent(event.target.checked);
                  if (!event.target.checked) {
                    setIdFrontFile(null);
                    setIdBackFile(null);
                    clearFacePhoto();
                  }
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <span>I have read and acknowledge this notice before providing identity documents or a face photo.</span>
            </label>
            {errors.privacyConsent && <p className="mt-1 font-semibold text-red-700">{errors.privacyConsent}</p>}
          </div>

          <fieldset disabled={!privacyConsent} className="space-y-4 disabled:opacity-60">
            <Field label="ID Type" id="registration-id-type" error={errors.idType}>
              <select id="registration-id-type" required value={idType} onChange={event => setIdType(event.target.value)} className={inputClass}>
                <option value="">Select a valid ID</option>
                {ID_TYPES.map(type => <option key={type}>{type}</option>)}
              </select>
            </Field>
            {idType === 'Other Accepted ID' && (
              <Field label="Describe the ID" id="registration-id-other" error={errors.idTypeOther}>
                <input id="registration-id-other" required value={idTypeOther} onChange={event => setIdTypeOther(event.target.value)} className={inputClass} />
              </Field>
            )}
            <div data-registration-first-upload tabIndex={-1}>
              <ImageUpload label="Front of Valid ID" file={idFrontFile} onChange={setIdFrontFile} required currentFileExists={Boolean(existingProfile?.id_front_path)} disabled={!privacyConsent} />
            </div>
            {errors.idFront && <p className="text-xs font-medium text-red-700">{errors.idFront}</p>}
            <ImageUpload label="Back of ID (when applicable)" file={idBackFile} onChange={setIdBackFile} currentFileExists={Boolean(existingProfile?.id_back_path)} disabled={!privacyConsent} />

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Face Verification</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">Face the camera directly, use sufficient lighting, and remove obstructions where practical. This image is reviewed manually; no facial recognition is performed.</p>
              </div>
              {cameraActive && (
                <div className="space-y-2">
                  <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview for face registration" className="max-h-64 w-full rounded-lg bg-slate-900 object-contain" />
                  <button type="button" onClick={captureFace} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700">
                    <Camera className="h-4 w-4" /> Capture Photo
                  </button>
                </div>
              )}
              {!cameraActive && facePreview && (
                <div className="space-y-2">
                  <img src={facePreview} alt="Face registration photo preview" className="max-h-64 w-full rounded-lg border border-slate-200 bg-white object-contain" />
                  {faceMethod === 'camera' && !faceConfirmed ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={clearFacePhoto} className="min-h-11 flex-1 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700">Retake Photo</button>
                      <button type="button" onClick={() => { setFaceConfirmed(true); setCameraMessage('Photo confirmed.'); }} className="min-h-11 flex-1 rounded-lg bg-emerald-600 text-sm font-bold text-white">Confirm Photo</button>
                    </div>
                  ) : (
                    <button type="button" onClick={clearFacePhoto} className="min-h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Remove / choose another</button>
                  )}
                </div>
              )}
              {!cameraActive && !facePreview && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={startCamera} disabled={!privacyConsent} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    <Camera className="h-4 w-4" /> Start Face Registration
                  </button>
                  <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" /> Upload a face photo
                    <input type="file" accept={IMAGE_ACCEPT} onChange={chooseFaceFile} disabled={!privacyConsent} className="sr-only" />
                  </label>
                </div>
              )}
              {existingProfile?.face_photo_path && !faceFile && faceMethod !== 'in_person' && <p className="text-xs font-medium text-emerald-700">A face photo is already on file.</p>}
              {cameraMessage && <p role="status" className="text-xs text-slate-600">{cameraMessage}</p>}
              {cameraError && <p role="alert" className="text-xs font-medium text-red-700">{cameraError}</p>}
              {errors.facePhoto && <p className="text-xs font-medium text-red-700">{errors.facePhoto}</p>}
              <div className="border-t border-slate-200 pt-3">
                <label className="flex min-h-11 cursor-pointer items-start gap-2 text-xs text-slate-700">
                  <input type="checkbox" checked={faceMethod === 'in_person'} onChange={event => { setFaceMethod(event.target.checked ? 'in_person' : 'camera'); clearFacePhoto(); }} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
                  <span>I cannot use a camera or upload a photo now. I will complete face verification in person at the Barangay Hall. My account will remain pending manual verification.</span>
                </label>
              </div>
            </div>
          </fieldset>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="registration-review-heading" className="space-y-4">
          <div>
            <h2 id="registration-review-heading" className="text-base font-bold text-slate-900">Review and Submit</h2>
            <p className="text-xs text-slate-500">Check your details. Your account will remain Pending Approval until an administrator reviews it.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2">
            <ReviewItem label="Full Name" value={fullName} />
            <ReviewItem label="Email" value={existingUser?.email || email} />
            <ReviewItem label="Date of Birth / Age" value={`${dateOfBirth} · ${age ?? '—'} years`} />
            <ReviewItem label="Mobile Number" value={mobileNumber} />
            <ReviewItem label="Gender" value={gender} />
            <ReviewItem label="Civil Status" value={civilStatus} />
            <ReviewItem label="ID Type" value={idType === 'Other Accepted ID' ? idTypeOther : idType} />
            <ReviewItem label="Front of ID" value={idFrontFile?.name || (existingProfile?.id_front_path ? 'Existing document on file' : 'Not provided')} />
            <ReviewItem label="Back of ID" value={idBackFile?.name || (existingProfile?.id_back_path ? 'Existing document on file' : 'Not provided (optional)')} />
            <ReviewItem label="Face Registration" value={faceMethod === 'in_person' ? 'In-person verification requested' : faceFile ? `${faceFile.name} (photo provided)` : 'Existing photo on file'} />
            <div className="sm:col-span-2">
              <ReviewItem label="Address" value={[houseStreet, purokSitio, barangay, municipalityCity, province].filter(Boolean).join(', ')} />
            </div>
          </div>
          {(idFrontPreview || idBackPreview || facePreview) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {idFrontPreview && <img src={idFrontPreview} alt="Front of ID review preview" className="h-32 w-full rounded-lg border border-slate-200 bg-white object-contain" />}
              {idBackPreview && <img src={idBackPreview} alt="Back of ID review preview" className="h-32 w-full rounded-lg border border-slate-200 bg-white object-contain" />}
              {facePreview && <img src={facePreview} alt="Face photo review preview" className="h-32 w-full rounded-lg border border-slate-200 bg-white object-contain" />}
            </div>
          )}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            <strong>Pending Manual Verification:</strong> Uploaded documents and photos are not automatically verified. Service requests remain unavailable until the administrator reviews your registration and approves your account.
          </div>
        </section>
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => step === 0 ? onSignIn() : setStep(current => Math.max(current - 1, 0))} disabled={isLoading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? (existingUser ? 'Sign Out' : 'Sign In') : 'Back'}
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={continueStep} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={isLoading} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Submit for Approval
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 break-words font-semibold text-slate-900">{value || '—'}</p>
    </div>
  );
}
