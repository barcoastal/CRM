@isTest
private with sharing class StateCodeUtilTest {
    
    @IsTest
    static void isValidStateTest() {

        Boolean isValidState; 
        String stateValue = 'al';
        Test.startTest();
        isValidState = StateCodeUtil.isValidState(stateValue);
        Test.stopTest();

        Assert.areEqual(true, isValidState, 'Expected valid state.');
    }

    @IsTest
    static void inValidStateTest() {

        Boolean isValidState; 
        String stateValue = 'ABCD';
        Test.startTest();
        isValidState = StateCodeUtil.isValidState(stateValue);
        Test.stopTest();

        Assert.areEqual(false, isValidState, 'Expected Invalid state.');
    }

    @IsTest
    static void blankStateTest() {

        Boolean isValidState; 
        String stateValue = '';
        Test.startTest();
        isValidState = StateCodeUtil.isValidState(stateValue);
        Test.stopTest();

        Assert.areEqual(false, isValidState, 'Expected false for blank state.');
    }
    
    @IsTest
    static void isNoBusinessStateTest() {
        
        Boolean isNoBusinessState; 
        String stateValue = 'Washington';
        Test.startTest();
        isNoBusinessState = StateCodeUtil.isNoBusinessState(stateValue);
        Test.stopTest();

        Assert.areEqual(true, isNoBusinessState, 'Expected valid no business state.');
    }
    
    @IsTest
    static void isNoBusinessStateWithStateCodeTest() {
        
        Boolean isNoBusinessState; 
        String stateValue = 'Wa';
        Test.startTest();
        isNoBusinessState = StateCodeUtil.isNoBusinessState(stateValue);
        Test.stopTest();

        Assert.areEqual(true, isNoBusinessState, 'Expected valid no business state.');
    }
    
    @IsTest
    static void isBusinessStateTest() {
        
        Boolean isNoBusinessState; 
        String stateValue = 'ohio';
        Test.startTest();
        isNoBusinessState = StateCodeUtil.isNoBusinessState(stateValue);
        Test.stopTest();

        Assert.areEqual(false, isNoBusinessState, 'Expected valid business state.');
    }
    
    @IsTest
    static void isBusinessStateWithStateCodeTest() {
        
        Boolean isNoBusinessState; 
        String stateValue = 'oH';
        Test.startTest();
        isNoBusinessState = StateCodeUtil.isNoBusinessState(stateValue);
        Test.stopTest();

        Assert.areEqual(false, isNoBusinessState, 'Expected valid business state.');
    }
}