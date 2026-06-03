@isTest
public class SettlementAfterTriggerHelperTest {
   
    @isTest
    public static void calculatePaymentSummaries(){
            Opportunity opp = new Opportunity(Name = 'Test Opportunity', CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

                Offer__c offer = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'Accepted',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer;
        
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
        Settlement__c settlement = new Settlement__c(Offer__c = offer.Id,RecordTypeId = recId,Opportunity__c = opp.Id);
        insert settlement; 
        
            
    }
    
      @isTest
    public static void calculatePaymentSummaries1(){
                    Account account = new Account(Name = 'Test Account');
        insert account;
        
            Opportunity opp = new Opportunity(Name = 'Test Opportunity', CloseDate = Date.today(), StageName = 'Prospecting');
        insert opp;

                Offer__c offer = new Offer__c(Opportunity__c = opp.Id, Offer_Status__c = 'Accepted',Payment_Method__c = 'Wire',Payment_Method_Amount__c = 15,
                                     Total_Settlement_Amount__c = 500, Settlement_Frequency__c = 'Monthly' ,Settlement_Term__c = '6',offer_Amount__c = 400);
        insert offer;
        
        Id recId = SettlementUtil.getRecordTypeId(SettlementUtil.RT_SETTLEMENTS);
        
        Settlement__c settlement = new Settlement__c(Offer__c = offer.Id,RecordTypeId = recId,Opportunity__c = opp.Id);
        insert settlement; 
        
        Settlement__c settlement1 = [Select Id,Account__c From Settlement__c limit 1];
        settlement1.Account__c = account.Id;
        update settlement1;
    }
}