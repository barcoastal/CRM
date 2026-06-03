@IsTest
public class FeeUtilTest {
    @IsTest
    static void testGetSObjName() {
        String expectedSObjName = 'Fee__c';
        FeeUtil feeUtil = new FeeUtil();
        String actualSObjName = feeUtil.getSObjName();
        System.assertEquals(expectedSObjName, actualSObjName);
    }
    @IsTest
    static void testGetSObjLabel() {
        String expectedSObjLabel = 'Fee';
        FeeUtil feeUtil = new FeeUtil();
        String actualSObjLabel = feeUtil.getSObjLabel();
        System.assertEquals(expectedSObjLabel, actualSObjLabel);
    }
    @IsTest
    static void testGetRecordTypeId() {
        String recordTypeName = 'Retainer_Fee';
        Id expectedRecordTypeId = Schema.SObjectType.Fee__c.getRecordTypeInfosByDeveloperName().get(recordTypeName).getRecordTypeId();
        Id actualRecordTypeId = FeeUtil.getRecordTypeId(recordTypeName);
        System.assertEquals(expectedRecordTypeId, actualRecordTypeId);
    }
}