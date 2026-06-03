@isTest
public class InboundPhoneLeadSourceMdtTest {
   
    @isTest
    static void getInboundPhoneLeadSource(){
        List<Inbound_Phone_Lead_Source_Mapping__mdt> InboundPhoneLeadSourceMdtList = [SELECT Id,To_Phone__c,Lead_Source__c FROM Inbound_Phone_Lead_Source_Mapping__mdt];
        String toPhoneNumber = InboundPhoneLeadSourceMdtList[0].To_Phone__c;
        String leadSourceMdt = InboundPhoneLeadSourceMdtList[0].Lead_Source__c;
        
        Test.startTest();
        String leadSource = InboundPhoneLeadSourceMdt.getInboundPhoneLeadSource(toPhoneNumber);
        Test.stopTest();
        
        Assert.areEqual(leadSource,leadSourceMdt);
    }
}