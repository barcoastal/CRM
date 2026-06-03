@IsTest
private class TwilioSMSWrapperTest {
    
    @IsTest
    static void testTwilioSMSWrapper() {
        
        // Create an instance of the TwilioSMSWrapper class
        TwilioSMSWrapper wrapper = new TwilioSMSWrapper();
        
        // Set the property values
        wrapper.accountSID = 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        wrapper.fromPhone = '+1234567890';
        wrapper.fromCity = 'City';
        wrapper.fromState = 'State';
        wrapper.fromZip = '12345';
        wrapper.fromCountry = 'Country';
        wrapper.messageSid = 'MSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
        wrapper.toPhone = '+9876543210';
        wrapper.messageBody = 'Test message';
        
        // Verify the property values
        System.assertEquals('ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', wrapper.accountSID);
        System.assertEquals('+1234567890', wrapper.fromPhone);
        System.assertEquals('City', wrapper.fromCity);
        System.assertEquals('State', wrapper.fromState);
        System.assertEquals('12345', wrapper.fromZip);
        System.assertEquals('Country', wrapper.fromCountry);
        System.assertEquals('MSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', wrapper.messageSid);
        System.assertEquals('+9876543210', wrapper.toPhone);
        System.assertEquals('Test message', wrapper.messageBody);
    }
}