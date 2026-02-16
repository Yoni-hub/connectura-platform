const DEFAULT_CREATE_PROFILE_SCHEMA = {
  sections: {
    household: {
      label: 'Household Information',
      groupSettings: {
        fields: { label: 'Household fields', visible: true },
        customFields: { label: 'Custom fields', visible: true },
      },
      fields: [],
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
      contactFields: [],
      addressTypes: ['Secondary Home', 'Rental Property'],
      residentialFields: [],
      mailingFields: [],
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
