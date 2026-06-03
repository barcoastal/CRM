@IsTest
private class SettlementWrapperTest {
    
    @IsTest
    static void settlemetFieldNameLabelMapTest() {        
        Map<String, String> fieldNameLabelMap = SettlementWrapper.fieldNameLabelMap;
        SettlementWrapper settlementWrap = new SettlementWrapper();
        Settlement__c settlementRecord = settlementWrap.getSettlementInstance();
        SettlementWrapper settlementWrappe = new SettlementWrapper(settlementRecord);
        settlementWrap.payeeId = '38456234';
        //settlementWrap.recordId = settlement.Id;
        settlementWrap.settlementAmount = 3455.23;
        System.assertEquals('Settlement Id', fieldNameLabelMap.get('recordId'));
        System.assertEquals('Payee Id', fieldNameLabelMap.get('payeeId'));
        System.assertEquals('Settlement Amount', fieldNameLabelMap.get('settlementAmount'));
        System.assertEquals('38456234', settlementWrap.payeeId);
        //System.assertEquals(settlement.Id, settlementWrap.recordId);
        System.assertEquals(3455.23, settlementWrap.settlementAmount);
    }
}