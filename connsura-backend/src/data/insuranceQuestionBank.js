const insuranceQuestionBank = [
  // General profile and contact
  'What is the full legal name of the insured?',
  'What is your date of birth?',
  'What is your primary phone number?',
  'What is your email address?',
  'What is your current mailing address?',
  'What is your residential address?',
  'What is your preferred contact method?',
  'What is the best time to contact you?',
  'Have you had any lapses in coverage in the last 12 months?',
  'What is your current insurance carrier?',
  'What is your current policy number?',
  'When does your current policy expire?',
  'What coverage limits do you want?',
  'What deductible do you prefer?',
  'Have you filed any claims in the last 3 years?',
  'Please list any prior losses or claims with dates and amounts.',
  'Do you need proof of insurance?',
  'Do you want to bundle policies?',
  'Are there any additional insureds?',
  'Do you require a certificate of insurance?',

  // Personal auto
  'What is the vehicle year, make, and model?',
  'What is the vehicle identification number (VIN)?',
  'Is the vehicle owned, financed, or leased?',
  'What is the primary use of the vehicle?',
  'How many miles do you drive per year?',
  'Where is the vehicle garaged overnight?',
  'Is the vehicle used for rideshare or delivery?',
  'Do you want liability-only or full coverage?',
  'What liability limits do you want?',
  'Do you want collision coverage?',
  'Do you want comprehensive coverage?',
  'Do you want uninsured/underinsured motorist coverage?',
  'Do you want medical payments or PIP coverage?',
  'Do you want rental reimbursement?',
  'Do you want roadside assistance?',
  'Are there any custom parts or equipment?',
  'Are there any drivers under 25?',
  'Has any driver had accidents or violations in the last 5 years?',
  'What is each driver’s license number?',
  'What is each driver’s license state?',
  'What is each driver’s marital status?',
  'What is each driver’s relationship to the named insured?',

  // Motorcycle, RV, boat, specialty vehicles
  'What is the motorcycle year, make, and model?',
  'Do you want accessory coverage for custom equipment?',
  'Is the motorcycle used for commuting or pleasure?',
  'What is the RV year, make, and model?',
  'Is the RV used full-time or part-time?',
  'What is the boat year, make, and model?',
  'What is the boat length and horsepower?',
  'Where is the boat stored when not in use?',
  'Do you operate the boat in saltwater or freshwater?',
  'Do you have any prior watercraft claims?',
  'Do you need trailer coverage?',
  'Do you need coverage for personal effects in the vehicle?',

  // Homeowners
  'What is the year the home was built?',
  'What is the square footage of the home?',
  'What is the construction type (frame, masonry, etc.)?',
  'What is the roof material and age?',
  'When were the plumbing and electrical systems updated?',
  'Is there a central alarm or monitored security system?',
  'Do you have a pool, trampoline, or dog on the property?',
  'Is the home primary, secondary, or seasonal?',
  'How many miles to the nearest fire station?',
  'Do you have prior homeowners claims in the last 5 years?',
  'What is the estimated replacement cost?',
  'What is the value of personal property to insure?',
  'Do you want loss of use coverage?',
  'Do you need scheduled personal property coverage?',
  'Do you have any home-based businesses?',

  // Renters / Condo
  'Are you renting or do you own a condo?',
  'What is the unit number and building address?',
  'Do you need coverage for improvements and betterments?',
  'What is the value of your personal property?',
  'Do you need additional living expense coverage?',
  'Do you have any roommates?',
  'Does your lease require liability coverage?',
  'Have you had renters or condo claims in the last 5 years?',

  // Landlord / Dwelling fire
  'Is the property tenant-occupied, vacant, or owner-occupied?',
  'How many units are on the property?',
  'Do you want loss of rents coverage?',
  'Is the property used for short-term rentals?',
  'Have there been any landlord claims in the last 5 years?',

  // Flood / Earthquake
  'Is the property located in a flood zone?',
  'Do you need building coverage, contents coverage, or both?',
  'What is the foundation type?',
  'Is the structure elevated or on slab?',
  'Do you need coverage for basements or lower levels?',
  'Is the property in an earthquake-prone area?',
  'Do you want a separate earthquake deductible?',

  // Umbrella / Excess
  'What underlying policies do you have (auto, home, etc.)?',
  'What are your underlying liability limits?',
  'Do you need $1M, $2M, or higher limits?',
  'Have you had any liability claims or lawsuits?',
  'Are there any high-risk exposures (pool, trampoline, dog)?',

  // Life insurance
  'What is the insured’s height and weight?',
  'Do you use tobacco or nicotine products?',
  'What coverage amount do you want?',
  'What term length do you prefer?',
  'Do you want term or permanent coverage?',
  'Who are the primary beneficiaries?',
  'Have you been diagnosed with any medical conditions?',
  'Have you been hospitalized in the last 5 years?',
  'Do you participate in hazardous activities?',
  'Do you want coverage for final expenses?',

  // Health insurance
  'How many people need to be covered?',
  'What are the ages of all applicants?',
  'Do you need coverage for dependents?',
  'Do you have a preferred doctor or network?',
  'Do you want an HMO, PPO, or HDHP?',
  'Do you have any ongoing prescriptions?',
  'Do you have any pre-existing conditions?',
  'Do you need dental or vision coverage?',

  // Dental / Vision
  'Do you want preventive-only or comprehensive dental coverage?',
  'Do you need orthodontia coverage?',
  'Do you want coverage for frames, lenses, or contacts?',
  'How often do you replace eyewear?',

  // Disability
  'What is your occupation and job duties?',
  'How much monthly benefit do you want?',
  'What is your annual income?',
  'Do you want short-term or long-term disability?',
  'What elimination period do you prefer?',
  'Do you want own-occupation coverage?',

  // Long-term care
  'Do you want home care, assisted living, or nursing facility coverage?',
  'What daily benefit amount do you want?',
  'What benefit period do you prefer?',
  'Do you want inflation protection?',

  // Travel
  'What are your travel dates and destination?',
  'How many travelers are in your party?',
  'Do you need trip cancellation coverage?',
  'Do you need medical evacuation coverage?',
  'Are you planning any adventure activities?',

  // Pet
  'What species and breed is your pet?',
  'What is your pet’s age?',
  'Do you want accident-only or accident and illness coverage?',
  'Do you want wellness coverage?',
  'Does your pet have pre-existing conditions?',

  // Business - general
  'What is the legal name of your business?',
  'What is your business address?',
  'What is your business website?',
  'What is your tax ID (EIN)?',
  'What is the business entity type?',
  'What is the nature of operations?',
  'How many years has the business operated?',
  'What are your annual gross revenues?',
  'How many employees do you have?',
  'Do you use subcontractors?',
  'Do you require additional insured endorsements?',
  'Do you need certificates for clients or landlords?',

  // General liability
  'What limits of general liability do you need?',
  'Do you need products and completed operations coverage?',
  'Do you need premises medical payments coverage?',
  'Do you have any prior GL claims or lawsuits?',
  'Do you perform work at client locations?',

  // Commercial auto
  'How many vehicles are in the commercial fleet?',
  'What are the vehicle years, makes, and models?',
  'Do you need hired and non-owned auto coverage?',
  'Do you transport hazardous materials?',
  'Are vehicles used across state lines?',
  'Do you need coverage for drivers not listed?',

  // Workers comp
  'What is your workers compensation class code?',
  'What is the estimated annual payroll by class code?',
  'Do you have any prior workers comp claims?',
  'Do you use 1099 contractors?',
  'Do you require coverage in multiple states?',

  // Commercial property
  'What is the building construction type?',
  'What is the building square footage?',
  'What is the building year built and roof age?',
  'Do you own or lease the building?',
  'What is the total insurable value of the building?',
  'What is the total insurable value of contents?',
  'Do you need business interruption coverage?',
  'Do you need equipment breakdown coverage?',

  // Inland marine / tools
  'Do you need coverage for tools and equipment?',
  'What is the total value of mobile equipment?',
  'Is equipment stored in vehicles overnight?',

  // Professional liability / E&O / malpractice
  'What professional services do you provide?',
  'What is your annual revenue from professional services?',
  'Have you had any prior E&O claims?',
  'Do you require a retroactive date?',
  'Do you need coverage for subcontractors?',

  // Cyber liability
  'Do you store or process customer data?',
  'What type of data do you store (PII, PHI, PCI)?',
  'What is your annual revenue from online sales?',
  'Do you have multi-factor authentication enabled?',
  'Have you had any prior data breaches?',
  'Do you need cyber extortion coverage?',

  // Directors & Officers / EPLI / Fiduciary
  'Do you need directors and officers coverage?',
  'Do you need employment practices liability coverage?',
  'How many employees do you have?',
  'Have you had any prior EPLI claims?',
  'Do you offer a 401(k) or benefit plan?',

  // Crime / Fidelity
  'Do you need employee dishonesty coverage?',
  'Do you need funds transfer fraud coverage?',
  'Do you handle cash on premises?',

  // Surety / bonds
  'Do you need a license, permit, or contract bond?',
  'What is the bond amount required?',
  'What is the obligee name?',
  'What is the project or contract value?',

  // Builders risk
  'What is the construction project address?',
  'What is the total project cost?',
  'What is the construction start and end date?',
  'Is the project new construction or renovation?',

  // Event / wedding
  'What is the event date and location?',
  'What is the expected number of attendees?',
  'Do you need host liquor liability coverage?',
  'Do you need coverage for rented equipment?',

  // Agriculture / crop / livestock
  'What crops or livestock do you need insured?',
  'What is the acreage or herd size?',
  'Do you need coverage for farm equipment?',

  // Environmental / pollution
  'Do you handle hazardous materials?',
  'Do you need pollution liability coverage?',
  'Have you had any prior pollution incidents?',

  // Aviation / marine
  'Do you own or operate an aircraft?',
  'What is the aircraft make, model, and tail number?',
  'Do you need passenger liability coverage?',
  'Do you need marine cargo coverage?',
  'What is the value of goods in transit?',

  // Specialty
  'Do you need identity theft coverage?',
  'Do you need kidnap and ransom coverage?',
  'Do you need warranty or service contract coverage?',
  'Do you need equipment breakdown for specialized machinery?',
]

module.exports = insuranceQuestionBank
