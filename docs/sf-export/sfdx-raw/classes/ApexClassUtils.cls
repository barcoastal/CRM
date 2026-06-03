/**
 * Description:
 * Provides some basic functionality to do stuff dynamically with ApexClass things
 */

 public with sharing class ApexClassUtils {

    /* I want to find all Apex classes that implement an interface please? Can you help me with that ? */
    public static List<String> findClassesImplementing(Type interfaceType) {

        /* Class names we find will be stored and returned in here */
        List<String> classNames = new List<String>();

        /* Figure out the interface 'name' from the interface 'type' we were given */
        String interfaceName = interfaceType.getName();
        
        /* Use this Spring '23 feature to find the classes */
        List<ApexTypeImplementor> interfaceImpls = [
        SELECT ClassName
        FROM ApexTypeImplementor 
        WHERE InterfaceName = :interfaceName 
          and IsConcrete=true];

        /* All we want is the class name, so suck those out of the result */  
        for (ApexTypeImplementor oneImplementor : interfaceImpls) {
            classNames.add(oneImplementor.ClassName);
        }
        /* .... and return */
        return classNames;
    }

    /* Super hack of the century to try and determine the name of a class
    when all you have is an instance of the class, and nothing else */
    public static String getClassName(Object classInstance) {
        return String.valueOf( classInstance ).substringBefore( ':' );
    }
}