public inherited sharing class CustomMergeFields {
    
    /**
     * @description: method to get the user fields in the SMS body
     * @param1: String textBodyWithMergeFields - A SMS body
     * @returnType: Set<String> - collection of the user fields
    */
    public static Set<String> getUserFieldsFromSMS(String textBodyWithMergeFields) {
        Set<String> fieldCollectionSet = new Set<String>();
        if (String.isNotBlank(textBodyWithMergeFields)) {
            fieldCollectionSet.addAll(collectFieldsFromTemplate(textBodyWithMergeFields, '[User.'));
        }
        return fieldCollectionSet;
    }

    /**
     * @description: method to get the Lead/Account/Contact fields in the SMS body
     * @param1: String textBodyWithMergeFields - A SMS body
     * @returnType: Set<String> - collection of the Lead/Account/Contact fields
    */
    public static Set<String> getFieldsFromSMS(String textBodyWithMergeFields) {
        Set<String> fieldCollectionSet = new Set<String>();
        if (String.isNotBlank(textBodyWithMergeFields)) {
            fieldCollectionSet.addAll(collectFieldsFromTemplate(textBodyWithMergeFields, '['));
        }
        return fieldCollectionSet;
    }

    /**
     * @description: method to get the SObject fields in the SMS body based on the start identifier
     * @param1: String textBodyWithMergeFields - A SMS body
     * @param2: String startIdentifier - Start Identifier to differentiate the user fields and other sobject fields
     * @returnType: Set<String> - collection of SObject fields
    */
    private static Set<String> collectFieldsFromTemplate(String textBodyWithMergeFields, String startIdentifier) {
        Set<String> fields = new Set<String>();
        do {
            String fieldString = textBodyWithMergeFields.subStringBetween(startIdentifier, ']');
            if (String.isNotBlank(fieldString)) {
                fields.add(fieldString);
                textBodyWithMergeFields = textBodyWithMergeFields.remove(startIdentifier + fieldString + ']');
            } else {
                break;
            }
        } while(String.isNotBlank(textBodyWithMergeFields.subStringBetween(startIdentifier, ']')));
        return fields;
    }

    /**
     * @description: method to merge the custom fields values in the SMS body
     * @param1: String textBodyWithMergeFields - A SMS body
     * @param1: Set<String> fields - A collection of fields
     * @param3: SObject sobjInstance - An SObject Instance which contains the values of the fields collection
     * @returnType: String - SMS body with the merged values of the custom fields.
    */
    public static String mergeFields(String textBodyWithMergeFields, Set<String> fields, SObject sobjInstance) {
        if (String.isNotBlank(textBodyWithMergeFields) && fields != null && !fields.isEmpty() && sobjInstance != null) {
            for (String fieldName : fields) {
                textBodyWithMergeFields = replaceMergeFields(sobjInstance, fieldName, textBodyWithMergeFields);
            }
        }
        return textBodyWithMergeFields; 
    }

    /**
     * @description: method to merge the custom fields values in the SMS body
     * @param1: String textBodyWithMergeFields - A SMS body
     * @param1: field - A field to be replaced with the value
     * @param3: SObject sobjInstance - An SObject Instance which contains the values of the fields collection
     * @returnType: String - SMS body with the merged values of the custom fields.
    */
    public static String replaceMergeFields(SObject sobjectInstance, String fieldName, String textBody) {
        if (sobjectInstance != null && String.isNotBlank(fieldName) && String.isNotBlank(textBody)) {
            String fieldValueString;
            Object fieldValueObject = sobjectInstance.get(fieldName);
            if (fieldValueObject != null) {
                fieldValueString = String.valueOf(fieldValueObject);
            }
            Id sObjectId = (Id)sobjectInstance.Id;
            if (ApexUtil.getSObjectName(sObjectId) == new UserUtil().getSObjName()) {
                textBody = textBody.replaceAll('\\[User.' + fieldName + '\\]', fieldValueString);
            } else {
                textBody = textBody.replaceAll('\\[' + fieldName + '\\]', fieldValueString);
            }
        }
        return textBody;
    }
}