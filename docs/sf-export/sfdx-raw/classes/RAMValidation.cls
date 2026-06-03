public inherited sharing class RAMValidation {
    public static String clientValidation(ClientWrapper clientWrap, List<String> clientRequiredField) {
        ApexUtil.requireValue('Client Wrapper', clientWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> clientWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(clientWrap));
        for (String fieldName : clientRequiredField) {
            if (ClientWrapper.fieldNameLabelMap.containsKey(fieldName)) {
                if (!clientWrapMap.containsKey(fieldName) || clientWrapMap.get(fieldName) == null) {
                    blankFields += ClientWrapper.fieldNameLabelMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Client Sync => The following fields should not be blank: ' + blankFields + '. ';
        } else {
            //Birthdate validation for minimum 18 years.
            if (!clientWrapMap.containsKey('dob') || clientWrapMap.get('dob') == null || (date.today() < date.valueOf(String.valueOf(clientWrapMap.get('dob'))).addyears(18)) )  {
                errorMessage += 'Client Sync => Birthdate should be minimum of 18 years.';
            }
        }
        if(String.isNotBlank(clientWrap.recordId) && String.isBlank(clientWrap.externalRAMId)){
           errorMessage += contractValidation(clientWrap.recordId);
        }
        return errorMessage;
    }
    public static String bankAccountValidation(BankAccountWrapper bankAccountWrap, List<String> bankAccountRequiredField) {
        ApexUtil.requireValue('Bank Account Wrapper', bankAccountWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> bankAccWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(bankAccountWrap));
        for (String fieldName : bankAccountRequiredField) {
            if (BankAccountWrapper.fieldNameLabelMap.containsKey(fieldName)) {
                if (!bankAccWrapMap.containsKey(fieldName) || bankAccWrapMap.get(fieldName) == null) {
                    blankFields += BankAccountWrapper.fieldNameLabelMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Bank Account Sync => The following fields should not be blank: ' + blankFields;
        } else {
            //Routing number validation for 9 digits.
            if (!bankAccWrapMap.containsKey('routingNumber') || bankAccWrapMap.get('routingNumber') == null || String.valueOf(bankAccWrapMap.get('routingNumber')).length() != 9 )  {
                errorMessage += 'Bank Account Sync => Routing number should be 9 digits.';
            }
        }
        return errorMessage;
    }
    public static String draftValidation(DraftWrapper draftWrap, List<String> draftRequiredField) {
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> draftWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(draftWrap));
        for (String fieldName : draftRequiredField) {
            if (DraftWrapper.fieldNameLabelMap.containsKey(fieldName)) {
                if (!draftWrapMap.containsKey(fieldName) || draftWrapMap.get(fieldName) == null) {
                    blankFields += DraftWrapper.fieldNameLabelMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Draft Sync => The following fields should not be blank: ' + blankFields + '. ';
        }
        return errorMessage;
    }
    
    private static String contractValidation(Id acctId) {
        String errorMessage = '';
        String missingDocuments = '';
        Opportunity oppRecord = OpportunityData.getActiveOpportunityId(acctId);
        if (oppRecord != null) {
            Set<Id> ramContractId = FileData.getContentDocumentIdsForSync(oppRecord);
            if(ramContractId.isEmpty()){
                errorMessage = 'RAM Agreement is required.';
            }
        }
        return errorMessage;
    }
}