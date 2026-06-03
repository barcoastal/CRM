@IsTest
private class EventUtilTest {
    
    @IsTest
    static void testGetSObjName(){        
        System.assertEquals('Event', new EventUtil().getSObjName());
    }

    @IsTest
    static void testGetSObjLabel(){        
        System.assertEquals('Event', new EventUtil().getSObjLabel());
    }
                             
    @IsTest
    static void testGetFieldsetDetails(){        
        
        List<SObjectUtilHelper.FieldSetDetails> fieldsetDetailsList = new EventUtil().getFieldsetDetails('Event_Disposition');
        
        System.assertEquals(4, fieldsetDetailsList.size());
        System.assertEquals('Subject', fieldsetDetailsList[0].fieldName);
        System.assertEquals('StartDateTime', fieldsetDetailsList[1].fieldName);
        System.assertEquals('EndDateTime', fieldsetDetailsList[2].fieldName);
        System.assertEquals('Description', fieldsetDetailsList[3].fieldName);
    }
}