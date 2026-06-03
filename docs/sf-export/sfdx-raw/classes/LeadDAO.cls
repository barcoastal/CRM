public without sharing class LeadDAO {
   
    public static Map<Id,Lead> getLeadsById(List<Id> leadIds){
       
        Map<Id,Lead> leadsById = new Map<Id,Lead>();

        /** Enhance this query to implement all fields from Lead */
        for (Lead oneLead : [SELECT Id,Status,Is_Payment_Amount_Populated__c, LeadSource, Company,FirstName,LastName,EIN_Number_Tax_Id__c,CloserLookup__c,Call_Transfer_Status__c,Call_Received_By_Lookup__c,Call_Received_Date__c,Total_Debt_Amount__c,Creditor_1_Total_Debt__c, Current_Total_Debt_Amount__c,Industry FROM Lead where Id IN: leadIds]) {

            leadsById.put(oneLead.Id,oneLead);
        }

        return leadsById; 
    }

    public static Lead getLeadById(Id leadId){

        Map<Id,Lead> leadsById = getLeadsById(new List<Id>{leadId}); 

        if (!leadsById.isEmpty() && leadsById.containsKey(leadId)) {
            
            return leadsById.get(leadId);
        }

        return null; 
    }
}