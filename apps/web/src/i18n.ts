// Minimal, dependency-free i18n for the PWA's static chrome (nav, headings,
// labels, buttons, and fixed status copy). Deliberately does NOT cover
// messages that embed raw API/network error text (e.g. "Submission
// failed: <server text>") — the server doesn't localize its own error
// strings, so half-translating those would read worse than leaving them
// in English. Checklist field labels are translated separately, per
// template (see ChecklistField.label_bn), since those come from data
// rather than this static dictionary.
//
// Bangla strings here are a best-effort machine-assisted translation for
// this specific domain, not reviewed by a native speaker — treat them as a
// working default to refine before a real pilot, not a final translation.

export type Language = 'en' | 'bn';

const dictionary = {
  appTitle: { en: 'E-Rickshaw Fitness', bn: 'ই-রিকশা ফিটনেস' },
  appSubtitle: { en: 'Inspector & roadside verification PWA', bn: 'পরিদর্শক ও সড়ক-পার্শ্ব যাচাইকরণ অ্যাপ' },
  navInspection: { en: 'Inspection', bn: 'পরিদর্শন' },
  navVerify: { en: 'Verify QR', bn: 'কিউআর যাচাই' },
  navAdmin: { en: 'Admin', bn: 'প্রশাসন' },
  offlineQueueLabel: { en: 'Offline queue', bn: 'অফলাইন সারি' },
  signOut: { en: 'Sign out', bn: 'সাইন আউট' },
  signInWithAuthority: { en: 'Sign in with authority identity', bn: 'কর্তৃপক্ষের পরিচয় দিয়ে সাইন ইন করুন' },
  completingSignIn: { en: 'Completing sign-in…', bn: 'সাইন-ইন সম্পন্ন হচ্ছে…' },
  devTokenLabel: { en: 'Access token (development only)', bn: 'অ্যাক্সেস টোকেন (শুধুমাত্র ডেভেলপমেন্ট)' },
  vehicleRegistryHeading: { en: 'Vehicle registry', bn: 'যানবাহন নিবন্ধন' },
  vehicleRegistryHelp: { en: 'Search an existing vehicle by chassis number or register one in your assigned district and zone.', bn: 'চেসিস নম্বর দিয়ে বিদ্যমান যানবাহন খুঁজুন অথবা আপনার নির্ধারিত জেলা ও অঞ্চলে নতুন যানবাহন নিবন্ধন করুন।' },
  chassisNumberLabel: { en: 'Chassis number', bn: 'চেসিস নম্বর' },
  searchVehicle: { en: 'Search vehicle', bn: 'যানবাহন খুঁজুন' },
  searching: { en: 'Searching…', bn: 'খোঁজা হচ্ছে…' },
  foundLabel: { en: 'Found:', bn: 'পাওয়া গেছে:' },
  motorLabel: { en: 'Motor', bn: 'মোটর' },
  statusLabel: { en: 'Status', bn: 'অবস্থা' },
  registerNewVehicle: { en: 'Register new vehicle', bn: 'নতুন যানবাহন নিবন্ধন করুন' },
  motorNumberLabel: { en: 'Motor number', bn: 'মোটর নম্বর' },
  ownerPhoneLabel: { en: 'Owner phone', bn: 'মালিকের ফোন নম্বর' },
  districtUuidLabel: { en: 'District UUID', bn: 'জেলা UUID' },
  zoneUuidLabel: { en: 'Zone UUID', bn: 'অঞ্চল UUID' },
  registerVehicleButton: { en: 'Register vehicle', bn: 'যানবাহন নিবন্ধন করুন' },
  submitInspectionHeading: { en: 'Submit fitness inspection', bn: 'ফিটনেস পরিদর্শন জমা দিন' },
  rickshawUuidLabel: { en: 'Rickshaw UUID', bn: 'রিকশা UUID' },
  checklistTemplateLabel: { en: 'Checklist template', bn: 'চেকলিস্ট টেমপ্লেট' },
  checklistTemplateUuidLabel: { en: 'Checklist template UUID', bn: 'চেকলিস্ট টেমপ্লেট UUID' },
  templatePlaceholder: { en: 'Template UUID (sync requires a published template)', bn: 'টেমপ্লেট UUID (সিঙ্কের জন্য প্রকাশিত টেমপ্লেট প্রয়োজন)' },
  noTemplatesHelp: { en: 'No cached templates available. Connect and sign in to load the current checklist.', bn: 'কোনো ক্যাশে করা টেমপ্লেট নেই। বর্তমান চেকলিস্ট লোড করতে সংযুক্ত হয়ে সাইন ইন করুন।' },
  refreshingTemplates: { en: 'Refreshing templates…', bn: 'টেমপ্লেট রিফ্রেশ হচ্ছে…' },
  liveTemplates: { en: 'Live templates', bn: 'লাইভ টেমপ্লেট' },
  cachedTemplatesOffline: { en: 'Cached templates (offline)', bn: 'ক্যাশে করা টেমপ্লেট (অফলাইন)' },
  notesLabel: { en: 'Notes', bn: 'মন্তব্য' },
  reasonIfFailedLabel: { en: 'Reason if failed', bn: 'ব্যর্থ হলে কারণ' },
  reasonPlaceholder: { en: 'Required only if this check failed', bn: 'শুধুমাত্র এই পরীক্ষা ব্যর্থ হলে প্রয়োজন' },
  resultLabel: { en: 'Result', bn: 'ফলাফল' },
  passOption: { en: 'Pass', bn: 'উত্তীর্ণ' },
  failOption: { en: 'Fail', bn: 'অনুত্তীর্ণ' },
  naOption: { en: 'N/A', bn: 'প্রযোজ্য নয়' },
  submitOrSaveOffline: { en: 'Submit / save offline', bn: 'জমা দিন / অফলাইনে সংরক্ষণ করুন' },
  syncSavedInspections: { en: 'Sync saved inspections', bn: 'সংরক্ষিত পরিদর্শন সিঙ্ক করুন' },
  certificateVerificationHeading: { en: 'Certificate verification', bn: 'সনদ যাচাই' },
  verificationHelp: { en: 'Offline signature verification works without internet. Live lookup checks the current certificate status and revocation state.', bn: 'অফলাইন স্বাক্ষর যাচাই ইন্টারনেট ছাড়াই কাজ করে। লাইভ অনুসন্ধান বর্তমান সনদের অবস্থা ও বাতিলকরণ পরীক্ষা করে।' },
  offlineQrSignatureHeading: { en: 'Offline QR signature', bn: 'অফলাইন কিউআর স্বাক্ষর' },
  qrPayloadLabel: { en: 'QR payload', bn: 'কিউআর পেলোড' },
  verifySignatureOffline: { en: 'Verify signature offline', bn: 'অফলাইনে স্বাক্ষর যাচাই করুন' },
  noOfflineVerificationYet: { en: 'No offline verification performed yet.', bn: 'এখনও কোনো অফলাইন যাচাই করা হয়নি।' },
  liveCertificateStatusHeading: { en: 'Live certificate status', bn: 'লাইভ সনদ অবস্থা' },
  certificateShortCodeLabel: { en: 'Certificate short code', bn: 'সনদ শর্ট কোড' },
  checkLiveStatus: { en: 'Check live status', bn: 'লাইভ অবস্থা পরীক্ষা করুন' },
  checking: { en: 'Checking…', bn: 'পরীক্ষা করা হচ্ছে…' },
  noLiveLookupYet: { en: 'No live lookup performed yet.', bn: 'এখনও কোনো লাইভ অনুসন্ধান করা হয়নি।' },
  provisionOidcUserHeading: { en: 'Provision OIDC user', bn: 'OIDC ব্যবহারকারী তৈরি করুন' },
  centralAdminRequired: { en: 'Central administrator access is required.', bn: 'কেন্দ্রীয় প্রশাসকের অ্যাক্সেস প্রয়োজন।' },
  externalSubjectLabel: { en: 'External identity subject', bn: 'বহিরাগত পরিচয় সাবজেক্ট' },
  externalSubjectPlaceholder: { en: 'identity-provider subject', bn: 'পরিচয়দাতার সাবজেক্ট' },
  displayNameLabel: { en: 'Display name', bn: 'প্রদর্শিত নাম' },
  roleLabel: { en: 'Role', bn: 'ভূমিকা' },
  roleInspector: { en: 'Inspector', bn: 'পরিদর্শক' },
  roleHubSupervisor: { en: 'Hub supervisor', bn: 'হাব সুপারভাইজার' },
  roleDistrictAdministrator: { en: 'District administrator', bn: 'জেলা প্রশাসক' },
  roleFinanceOperator: { en: 'Finance operator', bn: 'আর্থিক পরিচালক' },
  roleTrafficPoliceVerifier: { en: 'Traffic police verifier', bn: 'ট্রাফিক পুলিশ যাচাইকারী' },
  provisionUserButton: { en: 'Provision user', bn: 'ব্যবহারকারী তৈরি করুন' },
  operationsSummaryHeading: { en: 'Operations summary', bn: 'কার্যক্রম সারসংক্ষেপ' },
  operationsSummaryHelp: { en: 'Counts are limited to your assigned district scope.', bn: 'গণনা শুধুমাত্র আপনার নির্ধারিত জেলার মধ্যে সীমাবদ্ধ।' },
  refreshSummary: { en: 'Refresh summary', bn: 'সারসংক্ষেপ রিফ্রেশ করুন' },
  refreshing: { en: 'Refreshing…', bn: 'রিফ্রেশ হচ্ছে…' },
  summaryTokenHelp: { en: 'Enter an access token with an administrative or finance role to load the summary.', bn: 'সারসংক্ষেপ লোড করতে প্রশাসনিক বা আর্থিক ভূমিকাসহ একটি অ্যাক্সেস টোকেন দিন।' },
  summaryRickshaws: { en: 'Registered rickshaws', bn: 'নিবন্ধিত রিকশা' },
  summaryInspections: { en: 'Inspections', bn: 'পরিদর্শন' },
  summaryPaidBills: { en: 'Paid bills', bn: 'পরিশোধিত বিল' },
  summaryActiveCertificates: { en: 'Active certificates', bn: 'সক্রিয় সনদ' },
  summaryQueuedNotifications: { en: 'Queued notifications', bn: 'সারিবদ্ধ বিজ্ঞপ্তি' },
  reconciliationHeading: { en: 'Reconciliation exceptions', bn: 'মিলকরণ ব্যতিক্রম' },
  reconciliationHelp: { en: 'Failed and reversed payments, and bills otherwise flagged for review. Requires a finance or central administrator role.', bn: 'ব্যর্থ ও প্রত্যাহারকৃত পেমেন্ট, এবং পর্যালোচনার জন্য চিহ্নিত বিল। আর্থিক বা কেন্দ্রীয় প্রশাসকের ভূমিকা প্রয়োজন।' },
  refreshExceptions: { en: 'Refresh exceptions', bn: 'ব্যতিক্রম রিফ্রেশ করুন' },
  noReconciliationExceptions: { en: 'No reconciliation exceptions outstanding.', bn: 'কোনো মুলতুবি মিলকরণ ব্যতিক্রম নেই।' },
  reconciliationTokenHelp: { en: 'Enter an access token with a finance or central administrator role to load exceptions.', bn: 'ব্যতিক্রম লোড করতে আর্থিক বা কেন্দ্রীয় প্রশাসকের ভূমিকাসহ একটি অ্যাক্সেস টোকেন দিন।' },
  tableBill: { en: 'Bill', bn: 'বিল' },
  tableBillStatus: { en: 'Bill status', bn: 'বিলের অবস্থা' },
  tableAmount: { en: 'Amount', bn: 'পরিমাণ' },
  tableProvider: { en: 'Provider', bn: 'প্রদানকারী' },
  tablePaymentStatus: { en: 'Payment status', bn: 'পেমেন্টের অবস্থা' },
  tablePaymentAmount: { en: 'Payment amount', bn: 'পেমেন্টের পরিমাণ' },
  tableWhen: { en: 'When', bn: 'সময়' },
  readyMessage: { en: 'Ready. Sign in through the authority identity service before field use.', bn: 'প্রস্তুত। মাঠে ব্যবহারের আগে কর্তৃপক্ষের পরিচয় পরিষেবার মাধ্যমে সাইন ইন করুন।' },
  signedInProviderMessage: { en: 'Signed in through the authority identity provider.', bn: 'কর্তৃপক্ষের পরিচয় প্রদানকারীর মাধ্যমে সাইন ইন করা হয়েছে।' },
  signedOutMessage: { en: 'Signed out.', bn: 'সাইন আউট করা হয়েছে।' },
  inspectionSavedOfflineMessage: { en: 'Inspection safely saved on this device. It must be synced after authenticated connectivity returns.', bn: 'পরিদর্শনটি নিরাপদে এই ডিভাইসে সংরক্ষিত হয়েছে। সংযোগ ফিরে এলে এটি সিঙ্ক করা আবশ্যক।' },
  inspectionSubmittedMessage: { en: 'Inspection submitted. Payment instructions will be queued for passing vehicles.', bn: 'পরিদর্শন জমা দেওয়া হয়েছে। উত্তীর্ণ যানবাহনের জন্য পেমেন্ট নির্দেশনা সারিবদ্ধ করা হবে।' },
  connectBeforeSyncMessage: { en: 'Connect to the internet and sign in before syncing.', bn: 'সিঙ্ক করার আগে ইন্টারনেটে সংযুক্ত হয়ে সাইন ইন করুন।' },
  syncCompletedMessage: { en: 'Offline outbox synchronization completed.', bn: 'অফলাইন আউটবক্স সিঙ্ক্রোনাইজেশন সম্পন্ন হয়েছে।' },
  enterChassisToSearchMessage: { en: 'Enter a chassis number to search.', bn: 'খুঁজতে একটি চেসিস নম্বর লিখুন।' },
  connectBeforeSearchMessage: { en: 'Connect to the internet and sign in before searching the vehicle registry.', bn: 'যানবাহন নিবন্ধন খুঁজতে ইন্টারনেটে সংযুক্ত হয়ে সাইন ইন করুন।' },
  vehicleFoundMessage: { en: 'Vehicle found. You can use its UUID in the inspection form.', bn: 'যানবাহন পাওয়া গেছে। পরিদর্শন ফর্মে এর UUID ব্যবহার করতে পারেন।' },
  noVehicleFoundMessage: { en: 'No vehicle found with that chassis number.', bn: 'এই চেসিস নম্বরে কোনো যানবাহন পাওয়া যায়নি।' },
  vehicleRegRequiresOnlineMessage: { en: 'Vehicle registration requires an authenticated online connection.', bn: 'যানবাহন নিবন্ধনের জন্য প্রমাণীকৃত অনলাইন সংযোগ প্রয়োজন।' },
  userProvisionedMessage: { en: 'User provisioned successfully.', bn: 'ব্যবহারকারী সফলভাবে তৈরি হয়েছে।' }
} as const satisfies Record<string, Record<Language, string>>;

export type StringKey = keyof typeof dictionary;

const STORAGE_KEY = 'erf-language';

export function loadLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'bn' ? 'bn' : 'en';
  } catch {
    return 'en';
  }
}

export function persistLanguage(language: Language): void {
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* storage unavailable (e.g. private mode) */ }
}

export function translate(language: Language, key: StringKey): string {
  return dictionary[key][language];
}
