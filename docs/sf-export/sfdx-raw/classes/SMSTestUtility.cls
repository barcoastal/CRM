@isTest
public with sharing class SMSTestUtility {
    
    public static List<SMS__c> getSMSByToPhone(String toPhone){

        List<SMS__c> smsList; 

        try {
            smsList = [SELECT To_Phone__c, From_Phone__c,Message_body__c,Is_Inbound__c from SMS__C where To_Phone__c =:toPhone]; 
        } catch (Exception ex) {       
            ApplicationLogger.logException(ex, null); 
            throw new CustomException();
        }

        return smsList; 
    }
}