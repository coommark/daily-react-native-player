import ExpoModulesCore

public class DailyReactNativePlayerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyReactNativePlayer")

    Events("onChange")

    Constant("PI") {
      Double.pi
    }

    Function("hello") {
      return "Hello world! 👋"
    }

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}
