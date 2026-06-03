public inherited sharing class InboundPhoneLeadSourceMdt {
   
    public static String getInboundPhoneLeadSource(String toPhoneNumber){
         String leadSource;
         List<Inbound_Phone_Lead_Source_Mapping__mdt> inboundPhoneLeadSource = [ SELECT Id,To_Phone__c,Lead_Source__c FROM 
         Inbound_Phone_Lead_Source_Mapping__mdt WHERE To_Phone__c = :toPhoneNumber ];
        
         if(!inboundPhoneLeadSource.isEmpty() && String.isNotBlank(inboundPhoneLeadSource[0].Lead_Source__c)) {
            leadSource =  inboundPhoneLeadSource[0].Lead_Source__c;
         }
        return leadSource;
    }
}