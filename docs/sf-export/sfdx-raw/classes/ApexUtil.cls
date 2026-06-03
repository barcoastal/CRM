public inherited sharing class ApexUtil {

    public static final List<String> weekendDays = new List<String>{'Sunday' , 'Saturday'};

    public static void requireValue(String valueName, Object value) {
        if (value == null || value == '') {
            CustomException.variableBlankException(valueName);
        }
    }

    public static SObjectUtil getDynamicSObjectUtilInstance(String sObjectName) {
        Type t = Type.forName(sObjectName + 'Util');
        return t != null ? (SObjectUtil)t.newInstance() : null;
    }

    public static SObject removeSOQLMemory(SObject sobj) {
        String serializedSObjString = JSON.serialize(sobj);
        return (SObject)JSON.deserialize(serializedSObjString, SObject.class);
    }

    public static List<SObject> removeSOQLMemory(List<SObject> sObjList) {
        String serializedSObjListString = JSON.serialize(sObjList);
        return (List<SObject>)JSON.deserialize(serializedSObjListString, List<SObject>.class);
    }

    public static Decimal roundOffAmount(Decimal amt) {
        return amt.setScale(2, RoundingMode.HALF_UP);
    }

    public static Integer getNoOfWeeksBetweenTwoDates(Date startDate, Date endDate) {
        Integer noOfDays = startDate.daysBetween(endDate);
        return Integer.valueOf(Math.floor(noOfDays/7));
    }

    /**
     * @description: method to get the object key prefix based on the object API name.
     * @param objectName - String value of the object API name
     * @return String value of object key prefix
     */
    public static String getKeyPrefix(String objectName) {
        return Schema.getGlobalDescribe().get(objectName) != null ? Schema.getGlobalDescribe().get(objectName).getDescribe().getKeyPrefix() : null;
    }

    public static String getSObjectName(Id sObjId) {
        return sObjId.getSObjectType().getDescribe().getName();
    }

    /**
     * @description: method to get the record type Id based on the object API name and the record type developer name.
     * @param objectName - String value of the object API name
     * @param recordTypeName - String value of the record type developer name
     * @return record type Id
     */
    public static Id getRecordTypeIdbyDeveloperName(String objectName, String recordTypeName){
        return Schema.getGlobalDescribe().get(objectName) != null 
            && Schema.getGlobalDescribe().get(objectName).getDescribe().getRecordTypeInfosByDeveloperName().get(recordTypeName) != null
            ? Schema.getGlobalDescribe().get(objectName).getDescribe().getRecordTypeInfosByDeveloperName().get(recordTypeName).getRecordTypeId() : null;
    } 

    /**
     * @description: Method to do field value type conversion based on the field type
     * @param sObjectName API name of the Salesforce object.
     * @param sObjectInstanceJson JSON serialized string of the sobject instance.
     * @return sObject type converted sobject instance.
     */ 
    public static SObject typeConversion(String sObjectName, Map<String, String> fieldNameValueMap) {
        
        SObject record = ((SObject)Type.forName('Schema', sObjectName).newInstance());

        for(String fieldName : fieldNameValueMap.keySet()) {

            String fieldValue = fieldNameValueMap.get(fieldName);
            
            if (String.isBlank(fieldValue)) {
                record.put(fieldName, NULL);
                continue;
            }

            Schema.DescribeFieldResult field = Schema.getGlobalDescribe().get(sObjectName).getDescribe().fields.getMap().get(fieldName).getDescribe();  
            
            Switch on field.getType() {
                when STRING, ADDRESS, COMBOBOX, EMAIL, ENCRYPTEDSTRING, MULTIPICKLIST, PHONE, PICKLIST, REFERENCE, TEXTAREA, URL {
                    record.put(fieldName, String.valueOf(fieldValue));
                }
                when ID {
                    record.put(fieldName, Id.valueOf((String)fieldValue));
                }
                when BOOLEAN {
                    record.put(fieldName, Boolean.valueOf(fieldValue));
                }
                when DATE {
                    record.put(fieldName, Date.valueOf(fieldValue));
                }
                when DATETIME {
                    record.put(fieldName, DateTime.valueOf(fieldValue));
                }
                when DOUBLE, CURRENCY, PERCENT {
                    record.put(fieldName, Double.valueOf(fieldValue));
                }
                when INTEGER {
                    record.put(fieldName, Integer.valueOf(fieldValue));
                }
            }
        }
        return record;
    }

    public static Boolean validateEmailId(String emailId) {
        if (String.isNotBlank(emailId) && emailId.length() <= 80) {
            String emailRegex = '([a-zA-Z0-9_\\-\\.]+)@((\\[a-z]{1,3}\\.[a-z]{1,3}\\.[a-z]{1,3}\\.)|(([a-zA-Z0-9\\-]+\\.)+))([a-zA-Z0-9]{1,70})';
            Pattern myPattern = Pattern.compile(emailRegex);
            Matcher myMatcher = myPattern.matcher(emailId);
            return myMatcher.matches();
        }
        return false;
    }

    public static Boolean isWhoId(Id sObjId) {
        return ContactUtil.isContactId(sObjId) || LeadUtil.isLeadId(sObjId);
    }

    //This method should be replaced with the method in the StateCodeUtil
    public static String getUSStateAbbreviation(String stateValue) {
        String stateAbbreviation;
        if (String.isNotBlank(stateValue)) {
            if (stateValue.length() == 2) {
                stateAbbreviation = stateValue.toUpperCase();
            } else {
                stateValue = stateValue.toLowerCase();
                if (StateCodeUtil.stateCodeStateMap.containsKey(stateValue)) {
                    stateAbbreviation = StateCodeUtil.stateCodeStateMap.get(stateValue).toUpperCase();
                }
            }
        }
        return stateAbbreviation;
    }

    public static Boolean isAsyncContext() {
        return System.isFuture() || System.isBatch() || System.isQueueable();
    }
    
    public static Boolean isFuture() {
        return System.isFuture();
    }
    
    public static Boolean isBatch() {
        return System.isBatch();
    }

    public static String stringValue(Object objValue) {
        String stringValue;
        if (objValue != null) {
            stringValue = String.valueOf(objValue);
        }
        return stringValue;
    }

    public static void typeCastValue(Object inputValue) {
        if (inputValue instanceof String) {
            inputValue = String.valueOf(inputValue);
        } else if (inputValue instanceof Date) {
            inputValue = Date.valueOf(inputValue);
        } else if (inputValue instanceof DateTime) {
            inputValue = DateTime.valueOf(inputValue);
        } else if (inputValue instanceof Decimal) {
            inputValue = Decimal.valueOf(String.valueOf(inputValue));
        } else if (inputValue instanceof Integer) {
            inputValue = Integer.valueOf(inputValue);
        }
    }

    public static String getErrorMessage(Database.UpsertResult upsertResult) {
        String errorMessage = '';
        for (Database.Error err : upsertResult.getErrors()) {
            errorMessage += err.getMessage() + '. ';
        }
        return errorMessage;
    }

    public static Boolean isValidPhoneNumber(String phoneNumber){
        Boolean isValid = false;
        if(String.isNotBlank(phoneNumber) && phoneNumber.length() == 10){
            isValid = true;
        }
        return isValid;
    }
    
    //method returns day of week like Monday,Tuesday ....
    public static String getWeekDay(Date dateInstance) {

        Datetime dt = DateTime.newInstance(dateInstance.year(), dateInstance.month(), dateInstance.day());
            
        return dt.format('EEEE'); 
    }

    public static Id getUserIdByAlias(string alias){
        Id userId = [SELECT Id, Name FROM User WHERE Alias =: alias ][0].Id;
        return userId;
    }

    public static String getUserType(){
       return UserInfo.getUserType();
    }
    
    @InvocableMethod(label='Remove HTML Tags' description='Removes HTML tags from a string.')
    public static List<String> stripHtml(List<String> htmlStrings) {
        List<String> plainTexts = new List<String>();
        for (String htmlString : htmlStrings) {
            String strippedHtml = htmlString.replaceAll('<[^>]+>', '');
            plainTexts.add(strippedHtml);
        }
        return plainTexts;
    }    
}