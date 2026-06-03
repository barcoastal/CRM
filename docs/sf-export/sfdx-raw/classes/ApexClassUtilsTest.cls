/**
 * Test class for ApexClassUtils.
 * 
 * History:
 **/
@isTest
public with sharing class ApexClassUtilsTest implements ApexClassUtilsTest.SomeInterfaceI {


    /* Test the findClassesImplementing method */
    static testmethod void testfindClassesImplementing()  {
        
       
        Test.startTest();
        /* Surprise surprise, I wondder what is going to be in this list ??? :( */
        List<String> classes = ApexClassUtils.findClassesImplementing(ApexClassUtilsTest.SomeInterfaceI.class);
        Test.stopTest();

        System.assert(classes != null,'A null should never come back from the findClassesImplementing method. Something is messed up');
        System.assertEquals(1, classes.size(),'Because of the meticulous preparation for this test, we should have one and one only entry in the list of classes. Something is messed up');
        System.assert(classes.get(0) == 'ApexClassUtilsTest','the ONLY class that implements the supplied interface is ApexClassUtilsTest, so something has gone haywire here :(');
   
        }

    /* Test the getClassName method */
    static testmethod void testGetClassName()  {
        
       
        /* Create an instance of a class like so (Doesn't matter what the class is for this test,
        so let's just use this test class!!!! :) */

        String className;
        Object aClassInstance = new ApexClassUtilsTest();
        
        Test.startTest();
                className = ApexClassUtils.getClassName(aClassInstance);
        Test.stopTest();

        System.assert(className != null,'A null should never come back from the getClassName method. Something is messed up');
        System.assertEquals('ApexClassUtilsTest', className,'This is messed up. This should be the name of the class');
  
        }

    
    /* Implementation of the Interface (which we never use of course) */
    public String doSomething(String someText) {
        return someText.toUpperCase();
    }

    /* We'll use this moronic example here to do a basic test of ApexClassUtils */
    public interface SomeInterfaceI {
        String doSomething(String someText);
    }
}