const DEFAULT_CREATE_PROFILE_SCHEMA = {
  sections: {
    household: {
      label: 'Household Information',
      groupSettings: {
        fields: { label: 'Household fields', visible: true },
        customFields: { label: 'Custom fields', visible: true },
      },
      fields: [
        { id: 'first-name', label: 'First Name', type: 'text', visible: true },
        { id: 'middle-initial', label: 'Middle Initial', type: 'text', visible: true },
        { id: 'last-name', label: 'Last Name', type: 'text', visible: true },
        { id: 'suffix', label: 'Suffix', type: 'text', visible: true },
        { id: 'dob', label: 'Date of Birth', type: 'date', visible: true },
        { id: 'gender', label: 'Gender', type: 'select', visible: true },
        { id: 'marital-status', label: 'Marital Status', type: 'select', visible: true },
        { id: 'education-level', label: 'Education Level', type: 'select', visible: true },
        { id: 'employment', label: 'Employment', type: 'select', visible: true },
        { id: 'occupation', label: 'Occupation', type: 'text', visible: true },
        { id: 'driver-status', label: 'Driver Status', type: 'select', visible: true },
        { id: 'license-type', label: "Driver's License Type", type: 'select', visible: true },
        { id: 'license-status', label: 'License Status', type: 'select', visible: true },
        { id: 'years-licensed', label: 'Years Licensed', type: 'select', visible: true },
        { id: 'license-state', label: 'License State', type: 'select', visible: true },
        { id: 'license-number', label: 'License Number', type: 'text', visible: true },
        { id: 'accident-prevention', label: 'Accident Prevention Course', type: 'select', visible: true },
        { id: 'sr22', label: 'SR-22 Required?', type: 'select', visible: true },
        { id: 'fr44', label: 'FR-44 Required?', type: 'select', visible: true },
      ],
      customFields: [],
    },
    address: {
      label: 'Address Information',
      groupSettings: {
        contactFields: { label: 'Contact fields', visible: true },
        residentialFields: { label: 'Residential address fields', visible: true },
        mailingFields: { label: 'Mailing address fields', visible: true },
        customFields: { label: 'Custom fields', visible: true },
      },
      contactFields: [
        { id: 'phone1', label: 'Phone #1', type: 'tel', visible: true },
        { id: 'phone2', label: 'Phone #2', type: 'tel', visible: true },
        { id: 'email1', label: 'Email Address #1', type: 'email', visible: true },
        { id: 'email2', label: 'Email Address #2', type: 'email', visible: true },
      ],
      addressTypes: ['Secondary Home', 'Rental Property'],
      residentialFields: [
        { id: 'addressType', label: 'Address Type', type: 'select', visible: true },
        { id: 'address1', label: 'Street Address 1', type: 'text', visible: true },
        { id: 'address2', label: 'Street Address 2', type: 'text', visible: true },
        { id: 'city', label: 'City', type: 'text', visible: true },
        { id: 'state', label: 'State', type: 'text', visible: true },
        { id: 'zip', label: 'Zip Code', type: 'text', visible: true },
      ],
      mailingFields: [
        { id: 'address1', label: 'Street Address 1', type: 'text', visible: true },
        { id: 'address2', label: 'Street Address 2', type: 'text', visible: true },
        { id: 'city', label: 'City', type: 'text', visible: true },
        { id: 'state', label: 'State', type: 'text', visible: true },
        { id: 'zip', label: 'Zip Code', type: 'text', visible: true },
      ],
      customFields: [],
    },
    additional: {
      label: 'Additional Information',
      groupSettings: {
        customFields: { label: 'Custom fields', visible: true },
      },
      customFields: [],
    },
  },
}

module.exports = { DEFAULT_CREATE_PROFILE_SCHEMA }
