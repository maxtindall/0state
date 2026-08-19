# Homebrew formula for the 0state client — the terminal (`0state`) and the STATE
# miner (`statemine`). A Node CLI; installs its deps into libexec and symlinks
# both bins. Publish this in the tap repo (github.com/maxtindall/homebrew-frankcoin)
# as `0state.rb`, then:
#
#   brew tap  maxtindall/frankcoin
#   brew install maxtindall/frankcoin/0state          # from the tagged release
#   brew install --HEAD maxtindall/frankcoin/0state   # straight from main, today
#   brew upgrade  maxtindall/frankcoin/0state          # pull future updates
#
# NOTE: Homebrew maps the file name `0state.rb` to a class token that begins with
# a digit. This class is named `Zerostate`; if `brew audit` in the tap objects to
# the name, alias the formula `zerostate` and keep `0state` as an alias — the
# install/deps/bins below are unaffected.
class Zerostate < Formula
  desc "0state — communist DAO terminal and STATE proof-of-work miner"
  homepage "https://github.com/maxtindall/0state"
  # Tagged-release install. Fill sha256 after cutting v2.0.0 (shasum -a 256 on the tarball).
  url "https://github.com/maxtindall/0state/archive/refs/tags/v2.0.0.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"
  version "2.0.0"

  # Works today with `brew install --HEAD`, no release needed.
  head "https://github.com/maxtindall/0state.git", branch: "main"

  depends_on "node"

  def install
    cd "cli" do
      system "npm", "install", *std_npm_args
      bin.install_symlink libexec.glob("bin/*") # -> `0state` and `statemine`
    end
  end

  test do
    # `0state status` reads devnet and prints the org's program id.
    assert_match "0state", shell_output("#{bin}/0state status 2>&1", 0)
  end
end
