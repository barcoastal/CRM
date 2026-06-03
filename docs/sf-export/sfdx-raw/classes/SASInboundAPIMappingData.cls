public inherited sharing class SASInboundAPIMappingData { 
    public static List<SASInboundAPIMapping__mdt> querySASInboundBasedOnAPICallName(String apiCallName) {
        return [SELECT Id, API_Call_Name__c, SAS_Attribute_Name__c, SF_Field_Name__c 
            FROM SASInboundAPIMapping__mdt 
            WHERE API_Call_Name__c =:apiCallName
        ];
    }
}