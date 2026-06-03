public without sharing class SMSHandler {
    public static void processSMSRecords() {
        for (SMS__c smsRecord : (List<SMS__c>)Trigger.new) {
            if (smsRecord.Is_Inbound__c == true) {
                smsRecord.Sent_Received_Time__c = System.now();
            }
        }
    }
}