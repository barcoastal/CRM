/** Test Class: SASValidationTest */
public inherited sharing class SASValidation {

    public static String clientValidation(ClientWrapper clientWrap) {
        ApexUtil.requireValue('Client Wrapper', clientWrap);
        String errorMessage = '';
        String blankFields = '';
        Boolean contractNotFound = false;
        Map<String, Object> clientWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(clientWrap));
        for (String fieldName : SASWrapper.createClientMap.keySet()) {
            if (ClientWrapper.fieldNameLabelMap.containsKey(fieldName)) {
                if (!clientWrapMap.containsKey(fieldName) || clientWrapMap.get(fieldName) == null) {
                    String fieldLabel = ClientWrapper.fieldNameLabelMap.get(fieldName);
                    if (fieldLabel == 'Contract Details') {
                        contractNotFound = true;
                    } else {
                        blankFields += ClientWrapper.fieldNameLabelMap.get(fieldName) + ', ';
                    }
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Client Sync => The following fields should not be blank: ' + blankFields + '. ';
        }
        if (contractNotFound) {
            errorMessage += 'The client agreement document is not uploaded. ';
        }
        return errorMessage;
    }

    public static String bankAccountValidation(BankAccountWrapper bankAccountWrap) {
        ApexUtil.requireValue('Bank Account Wrapper', bankAccountWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> bankAccountWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(bankAccountWrap));
        for (String fieldName : SASWrapper.createBankAccountMap.keySet()) {
            if (BankAccountWrapper.fieldNameLabelMap.containsKey(fieldName)) {
                if (!bankAccountWrapMap.containsKey(fieldName) || bankAccountWrapMap.get(fieldName) == null) {
                    blankFields += BankAccountWrapper.fieldNameLabelMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Bank Account Sync => The following fields should not be blank: ' + blankFields + '. ';
        }
        return errorMessage;
    }
    
    public static String draftValidation(DraftWrapper draftWrap) {
        ApexUtil.requireValue('Draft Wrapper', draftWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> draftWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(draftWrap));
        for (String fieldName : SASWrapper.createDraftMap.keySet()) {
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

    public static String draftsValidation(DraftWrapper draftWrap) {
        String errorMessage = '';
        if (draftWrap == null) {
            errorMessage = 'DraftWrapper is blank.';
        } else {
            if (draftWrap.paymentDate == null) {
                errorMessage += 'Draft Date is blank.';
            }
            if (draftWrap.totalAmount == null) {
                errorMessage += 'Draft Total Amount is blank.';
            }
            if (draftWrap.payouts == null || draftWrap.payouts.isEmpty()) {
                errorMessage += 'Payouts are blank.';
            }
        }
        return errorMessage;
    }

    public static String settlementsValidation(SettlementWrapper settlementWrap) {
        String errorMessage = '';
        if (settlementWrap == null) {
            errorMessage = 'Settlement Wrapper is blank.';
        } else {
            if (settlementWrap.settlementDate == null) {
                errorMessage += 'Settlement Date is blank.';
            }
            if (settlementWrap.settlementAmount == null) {
                errorMessage += 'Settlement Amount is blank.';
            }
        }
        return errorMessage;
    }

    public static String cancelDraftValidation(DraftWrapper draftWrap) {
        ApexUtil.requireValue('Draft Wrapper', draftWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> draftWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(draftWrap));
        for (String fieldName : SASWrapper.cancelDraftMap.keySet()) {
            if (SASWrapper.cancelDebitLabelsMap.containsKey(fieldName)) {
                if (!draftWrapMap.containsKey(fieldName) || draftWrapMap.get(fieldName) == null) {
                    blankFields += SASWrapper.cancelDebitLabelsMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Cancel Drafts Sync => The following fields should not be blank: ' + blankFields;
        }
        return errorMessage;
    }

    public static String contractValidation(FileWrapper fileWrap) {
        ApexUtil.requireValue('File Wrapper', fileWrap);
        String errorMessage = '';
        String blankFields = '';
        Map<String, Object> fileWrapMap = (Map<String, Object>)JSON.deserializeUntyped(JSON.serialize(fileWrap));
        for (String fieldName : SASWrapper.uploadContractMap.keySet()) {
            if (FileWrapper.requiredNodesMap.containsKey(fieldName)) {
                if (!fileWrapMap.containsKey(fieldName) || fileWrapMap.get(fieldName) == null) {
                    blankFields += FileWrapper.requiredNodesMap.get(fieldName) + ', ';
                }
            }
        }
        if (String.isNotBlank(blankFields)) {
            blankFields = blankFields.removeEnd(', ');
            errorMessage += 'Upload Contract => The following fields should not be blank: ' + blankFields;
        }
        return errorMessage;
    }
       
    public static String payeeValidation(ClientWrapper clientWrap) {
        ApexUtil.requireValue('Client Wrapper', clientWrap);
        String errorMessage;
        List<String> blankFields = new List<String>();
        if (String.isBlank(clientWrap.firstName)) {
            blankFields.add('First Name');
        }
        if (String.isBlank(clientWrap.lastName)) {
            blankFields.add('Last Name');
        }
        if (String.isBlank(clientWrap.taxId)) {
            blankFields.add('Tax Id');
        }
        if (String.isBlank(clientWrap.email)) {
            blankFields.add('Email');
        }
        if (String.isBlank(clientWrap.phone)) {
            blankFields.add('Phone');
        }
        if (String.isBlank(clientWrap.address)) {
            blankFields.add('Billing Street');
        }
        if (String.isBlank(clientWrap.city)) {
            blankFields.add('Billing City');
        }
        if (String.isBlank(clientWrap.state)) {
            blankFields.add('Billing State');
        }
        if (String.isBlank(clientWrap.postalCode)) {
            blankFields.add('Billing Postal Code');
        }
        if (String.isBlank(clientWrap.country)) {
            blankFields.add('Billing Country');
        }
        if (!blankFields.isEmpty()) {
            errorMessage = 'Payee Sync => The following fields should not be blank: ' + String.join(blankFields, ',');
        }
        return errorMessage;
    }
    
}