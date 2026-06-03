public inherited sharing class SMSData {

    public static List<SMS__c> querySMS(String phoneNumber) {
        Set<String> phoneNumbers = new Set<String>();
        phoneNumbers.add(phoneNumber);
        if (phoneNumber.startsWith(SMSWrapper.PH_PREFIX)) {
            phoneNumbers.add(phoneNumber.removeStart(SMSWrapper.PH_PREFIX));
        } else {
            phoneNumbers.add(SMSWrapper.PH_PREFIX + phoneNumber);
        }
        return [SELECT Id, Is_Inbound__c, Message_Body__c, From_Phone__c, To_Phone__c,
            CreatedBy.Name, CreatedDate, Sent_Received_Time__c, Outbound_Failure_Reason__c 
            FROM SMS__c WHERE (Is_Inbound__c = true AND From_Phone__c IN :phoneNumbers) 
            OR (Is_Inbound__c = false AND To_Phone__c IN :phoneNumbers) ORDER BY Sent_Received_Time__c, CreatedDate ASC];
    }
}